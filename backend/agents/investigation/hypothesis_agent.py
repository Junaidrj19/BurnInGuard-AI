from __future__ import annotations

import json
import math
from typing import Any, Dict, List

from backend.agents.investigation.models.evidence import EvidenceRecord
from backend.agents.investigation.models.hypothesis import (
    CandidateMechanism,
    Hypothesis,
    HypothesisStatus,
    MechanismType,
)
from backend.llm.factory import create_mock_client
from backend.llm.interface import LLMClient, LLMMessage
from backend.llm.settings import LLMSettings

MAX_EVIDENCE_CHARS = 1200
MAX_DETERMINISTIC_RESULTS = 40
MAX_CONTEXT_CHARS = 24000

# Significant digits used when rendering deterministic float outputs into the
# prompt. The tools emit full binary float repr (e.g. -0.01892085301992452,
# 17 significant digits). These are physical measurements derived from 501
# observations, so digits beyond ~6 encode no measurable quantity while costing
# prompt tokens on every one of the 40 results. The unrounded values are
# untouched in InvestigationState, the persisted record and the UI — this
# rounding applies only to the text handed to the model.
SIGNIFICANT_DIGITS = 6


def _format_value(value: Any) -> str:
    """Render one deterministic output value for the prompt."""
    if isinstance(value, float):
        if not math.isfinite(value):
            return json.dumps(str(value))
        return f"{value:.{SIGNIFICANT_DIGITS}g}"
    if isinstance(value, str):
        return value
    return json.dumps(value, separators=(",", ":"))

# Completion budget for one hypothesis response.
#
# This is provider- and model-sensitive, so it is measured rather than guessed.
#
# OpenRouter / meta-llama/llama-3.3-70b-instruct: a complete, schema-valid
# response with 2 candidates used 428 completion tokens and finished with `stop`,
# so 1500 was ample. On that provider the ceiling was also a COST reservation —
# OpenRouter rejects with HTTP 402 ("You requested up to N tokens, but can only
# afford M") before generating, so an oversized ceiling became a hard failure.
#
# Groq / openai/gpt-oss-120b: this is a reasoning model that emits reasoning
# tokens before the answer, so the completion budget must cover reasoning plus
# the JSON. Measured against the real agent context, the requirement varies with
# how many candidate mechanisms the model proposes:
#   2,029 tokens (5 candidates), 2,327 (5), 2,546 (6)
# 1500 and 2500 both produced `finish_reason=length` and truncated,
# schema-invalid JSON on at least one run, so neither is reliable. 3000 finished
# with `stop` and valid JSON on every trial.
#
# The ceiling is bounded above by Groq's free tier, which meters prompt AND
# completion against 8,000 tokens per minute. With the reduced prompt (4,569
# tokens, measured) the worst case is 4,569 + 3,000 = 7,569, still inside the
# window; the observed real totals were 6,896 and 7,115.
#
# The earlier HTTP 429 came from the other side of the same budget: a 6,448-token
# prompt plus this completion budget sat at ~8,477 and exceeded the limit. The
# prompt was reduced to 4,569 by removing provably redundant text — see
# `_deterministic_block` and the schema encoding in `structured_completion` — not
# by dropping any deterministic finding or evidence record.
#
# Occasional over-long generations remain handled by the retry loop in
# `structured_completion`, which re-prompts on invalid JSON.
HYPOTHESIS_MAX_TOKENS = 3000

SYSTEM_PROMPT = """You are the hypothesis agent of a SiC MOSFET reliability investigation.

You receive deterministic degradation calculations computed by fixed engineering tools, and
retrieved passages from an engineering knowledge base. Propose CANDIDATE degradation mechanisms.

Epistemic rules (non-negotiable):
1. Never assert a physical failure as confirmed. Every mechanism is a candidate that requires
   engineering confirmation.
2. Never claim a one-to-one diagnostic mapping. RDS_on, VTH, IGSS, IDSS, Tj and related signals
   can each be affected by several mechanisms (temperature, channel/device degradation, package and
   interconnect degradation, measurement conditions/hysteresis), so state the ambiguity explicitly.
3. Only cite evidence ids that appear verbatim in the evidence_records provided. Never invent,
   renumber or paraphrase an evidence id.
4. Status semantics: SUPPORTED = the provided evidence actively argues for the candidate;
   CONTRADICTED = the provided evidence argues against it; CANDIDATE = plausible but
   incompletely supported; AMBIGUOUS = the evidence fits several mechanisms equally;
   INSUFFICIENT_EVIDENCE = the evidence cannot discriminate. Prefer INSUFFICIENT_EVIDENCE over
   speculation, and always give a reasoning string explaining the status.
5. Put evidence that argues against a candidate in contradictory_evidence_ids, and describe the
   residual uncertainty and measurement limitations in reasoning.
6. distinguishing_measurements lists the measurements that would separate this candidate from the
   alternatives.
7. Do not invent numerical values: quote only numbers that appear in the deterministic results.

Mechanism must be one of: bond_wire_interconnect, die_attach_thermal_path, gate_related,
thermal_path, package_interconnect, other."""


class HypothesisValidationError(ValueError):
    pass


class HypothesisAgent:
    def __init__(self, llm: LLMClient | None = None, settings: LLMSettings | None = None):
        self.settings = settings or LLMSettings()
        self.llm = llm or create_mock_client()

    def _deterministic_block(self, deterministic: List[Any]) -> List[str]:
        """Serialise every deterministic result compactly, losing no finding.

        The verbose per-result JSON encoding repeated a large amount of text that
        is provably constant or derivable across all 40 results, which inflated the
        prompt without adding information:

        * ``tool_version``, ``input_summary.n``, ``compare_population.reference_n``
          and ``provenance.reference_artifact`` each hold a single value for the
          whole run, so they are stated once in a legend instead of 40 times.
        * ``provenance.method`` takes one value per tool, so it also moves to the
          legend.
        * ``provenance.signal`` duplicates ``input_summary.signal``, which becomes
          the group heading.
        * ``calculate_drift.input_summary.baseline`` is equal to its own
          ``output.first`` in every row, so it is dropped as a duplicate.
        * Raw float repr carried ~17 significant digits (``-0.01892085301992452``);
          these are physical measurements, so they are rendered at
          ``SIGNIFICANT_DIGITS`` instead.

        Every tool, every signal and every output value still reaches the model.
        Nothing is truncated, and the full unabridged values remain in
        ``InvestigationState`` for the record, provenance and the UI.
        """
        results = deterministic[:MAX_DETERMINISTIC_RESULTS]
        tools = {r.tool_name for r in results}
        lines = [
            f"deterministic_results: {len(results)} result(s) from "
            f"{len(tools)} fixed engineering tool(s)."
        ]

        # Legend: values that are constant for the whole run, stated once.
        legend: List[str] = []
        observation_counts = {
            (r.input_summary or {}).get("n")
            for r in results
            if (r.input_summary or {}).get("n") is not None
        }
        if len(observation_counts) == 1:
            legend.append(f"observations_per_signal={observation_counts.pop()}")
        reference_ns = {
            (r.input_summary or {}).get("reference_n")
            for r in results
            if (r.input_summary or {}).get("reference_n") is not None
        }
        if len(reference_ns) == 1:
            legend.append(f"reference_population_n={reference_ns.pop()}")
        if legend:
            lines.append("; ".join(legend))

        methods: Dict[str, str] = {}
        for r in results:
            method = (r.provenance or {}).get("method")
            if method:
                methods.setdefault(r.tool_name, method)
        if methods:
            lines.append(
                "tool_methods: " + "; ".join(f"{k}={v}" for k, v in sorted(methods.items()))
            )
        reference_artifacts = {
            (r.provenance or {}).get("reference_artifact")
            for r in results
            if (r.provenance or {}).get("reference_artifact")
        }
        if len(reference_artifacts) == 1:
            lines.append(f"reference_artifact: {reference_artifacts.pop()}")

        # One group per signal, one line per tool. Preserves the full cross-signal
        # comparison the competing-mechanism reasoning depends on.
        grouped: Dict[str, List[Any]] = {}
        for r in results:
            signal = (r.input_summary or {}).get("signal") or (r.provenance or {}).get("signal")
            grouped.setdefault(signal or "unscoped", []).append(r)

        for signal, rows in grouped.items():
            lines.append(f"[{signal}]")
            for r in rows:
                rendered = " ".join(
                    f"{k}={_format_value(v)}"
                    for k, v in (r.output or {}).items()
                    if v is not None
                )
                lines.append(f"  {r.tool_name}: {rendered}")
        return lines

    def _build_context(self, state: Dict[str, Any]) -> str:
        parts = [f"module_id: {state.get('module_id')}", f"model_id: {state.get('model_id')}"]

        parts.extend(self._deterministic_block(state.get("deterministic_results", []) or []))

        # Evidence: every retrieved record is passed in full. Only fields the
        # hypothesis stage cannot use are omitted, and each is provably redundant
        # or unused rather than merely low-value:
        #   document_id  — literally the prefix of evidence_id
        #   title        — reproduced verbatim inside citation
        #   source_type / page_start / page_end — never referenced by the model,
        #                  which cites evidence_id, not a page
        # mechanisms, observables and test_conditions are retained because they
        # carry the evidence-to-mechanism and measurement-condition mapping the
        # competing-mechanism reasoning requires. All omitted fields remain intact
        # on the EvidenceRecord for provenance, citation rendering and the UI.
        evidence = state.get("evidence_records", []) or []
        parts.append(f"evidence_records ({len(evidence)} total):")
        for e in evidence:
            parts.append(json.dumps({
                "evidence_id": e.evidence_id,
                "citation": e.citation,
                "mechanisms": e.mechanisms,
                "observables": e.observables,
                "test_conditions": e.test_conditions,
                "text": (e.retrieved_text or "")[:MAX_EVIDENCE_CHARS],
            }, separators=(",", ":")))

        validation_errors = (state.get("errors") or {}).get("hypothesis_validation")
        if validation_errors:
            parts.append(
                "previous_attempt_rejected_by_validation: " + str(validation_errors)[:1500]
                + "\nFix the rejection: cite only evidence ids listed above."
            )

        return "\n".join(parts)[:MAX_CONTEXT_CHARS]

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        if self.llm is None:
            hypothesis = Hypothesis(
                module_id=state.get("module_id", ""),
                candidates=[],
                note="llm_unavailable",
            )
            return {"hypothesis": hypothesis, "errors": {"hypothesis": "LLM unavailable; no hypothesis generated"}}

        context = self._build_context(state)
        messages = [LLMMessage(role="user", content=context)]
        try:
            hypothesis = self.llm.structured_completion(
                messages,
                system=SYSTEM_PROMPT,
                response_model=Hypothesis,
                temperature=0.1,
                max_tokens=HYPOTHESIS_MAX_TOKENS,
            )
        except Exception as e:
            return {
                "hypothesis": Hypothesis(
                    module_id=state.get("module_id", ""),
                    candidates=[],
                    note="llm_failed",
                ),
                "errors": {"hypothesis": f"LLM failure ({self.llm.provider_name}): {e}"},
                "limitations": ["llm_reasoning_unavailable"],
            }
        return {"hypothesis": hypothesis}


def validate_hypothesis(hypothesis: Hypothesis, evidence_records: List[EvidenceRecord]) -> List[str]:
    errors = []
    known_ids = {e.evidence_id for e in evidence_records}
    for c in hypothesis.candidates:
        if c.confidence < 0.0 or c.confidence > 1.0:
            errors.append(f"candidate {c.mechanism} confidence out of range: {c.confidence}")
        if c.status in (HypothesisStatus.CANDIDATE, HypothesisStatus.SUPPORTED, HypothesisStatus.CONTRADICTED):
            if not c.supporting_evidence_ids:
                errors.append(f"candidate {c.mechanism} status {c.status} requires at least one supporting evidence id")
        for eid in c.supporting_evidence_ids + c.contradictory_evidence_ids:
            if eid not in known_ids:
                errors.append(f"candidate {c.mechanism} references unknown evidence id: {eid}")
        if c.status in (HypothesisStatus.INSUFFICIENT_EVIDENCE, HypothesisStatus.AMBIGUOUS):
            if not c.supporting_evidence_ids and not c.reasoning:
                errors.append(f"candidate {c.mechanism} {c.status} must explain the explicit reason")
    return errors
