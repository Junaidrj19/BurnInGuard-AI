# BurnInGuard AI — domain adaptation record

This document records exactly what the BurnInGuard AI product adaptation changed,
what it deliberately did not change, and where each product-facing concept comes
from in the backend.

It exists so that a reviewer can check any claim in the UI against a real field,
and so that nothing in the product layer can quietly drift away from the
engineering layer.

## Scope of the adaptation

**Changed:** product naming, user-facing terminology, navigation, the screening
disposition presentation, the demonstration-case framing, three new read-only
pages, two new investigation-scoped pages, and the documentation.

**Not changed:** the backend. No file under `backend/` or `ml/` was modified. No
API route was added. No threshold was altered. No artifact was regenerated. No
M1–M9 contract, algorithm, or test changed. The adaptation is entirely in
`frontend/` and in documentation.

This is verifiable: `git status` shows no modification under `backend/` or `ml/`,
and the M7/M8 artifact hashes match `deploy/scientific-artifacts.manifest`.

## Terminology map

Presentation labels only. Backend field names are unchanged and are still shown
verbatim next to their product labels wherever an engineer needs to correlate the
UI with an API payload.

| Product label | Backend field / source | Notes |
| --- | --- | --- |
| Component | `module_id` | Field name unchanged throughout the API and types |
| Component ID | `module_id` | |
| Lot | `lot_id` | |
| Stress Run ID | `test_id` | Not a run resource; an attribute on the component summary |
| Screening status | `module_anomaly_status` | Raw value still displayed |
| Screening disposition | derived — see below | Not a backend field |
| Parametric drift monitoring | M6 features + M7 scoring | |
| Engineering failure investigation | M9 pipeline | Never "fault diagnosis" |
| Candidate failure mechanisms | `Hypothesis.candidates` | Never "failure diagnosis" |
| Engineering Reliability Knowledge Base | `knowledge_base/metadata/corpus.json` | Deliberately not "Burn-In Knowledge Base" |

The route `/modules` was renamed to `/components`. The old path permanently
redirects (`next.config.mjs`), and the **backend path is still `GET /modules`** —
see `frontend/lib/api/endpoints.ts`.

## Screening disposition derivation

Implemented in `frontend/lib/domain/disposition.ts`. It is a presentation-layer
mapping over a value the backend already computed. It introduces no threshold and
performs no prediction.

| Disposition | Condition | Source |
| --- | --- | --- |
| PASS | `module_anomaly_status == "clean"` | `ml/anomaly/aggregate.py` |
| MONITOR | `module_anomaly_status == "sporadic"` | `ml/anomaly/aggregate.py` |
| FLAG | `module_anomaly_status == "persistent"` | `ml/anomaly/aggregate.py` |
| EARLY REJECT | a recorded `check_acceptance_limits` result with `n_violations > 0` | `backend/agents/investigation/tools/limits.py` |
| *not derived* | any unrecognised status | rendered as NOT DERIVED, never as PASS |

`module_anomaly_status` itself is assigned by the pre-existing backend rule:
`clean` when no observation was flagged, `sporadic` below
`ANOMALY_RATE_SPORADIC_CUTOFF` (0.1, `ml/anomaly/aggregate.py:13`), `persistent`
at or above it. **That cutoff already existed**; the adaptation references it and
does not define, alter, or extend it.

Three deliberate constraints:

1. **The derivation is always rendered with the disposition.** `DispositionChip`
   shows the source field and its verbatim value, so an evaluator can see the
   label is derived rather than predicted.
2. **EARLY REJECT cannot come from anomaly status.** It requires a real
   acceptance-limit violation, which is only evaluated inside an investigation.
   Without an investigation it is never shown.
3. **EARLY REJECT is not styled red.** Red is reserved for system failure and
   validation rejection. An early-reject disposition awaits engineering review; it
   is not a confirmed physical failure. It is separated from FLAG by shape and a
   glyph instead of a new hue.

At population and lot level, EARLY REJECT is omitted entirely rather than shown as
zero, because population counts contain no acceptance-limit results — reporting
zero would assert that no component violated its limits, which that data cannot
support.

## Capabilities deliberately shown as not implemented

Each of these is requested by the BurnInGuard product concept and is **absent from
the backend**. Each renders with the existing not-implemented convention rather
than with placeholder data.

| Capability | Why it is absent |
| --- | --- |
| Burn-in runs as a resource | No run entity, lifecycle, or endpoint. `test_id` is a column on the component summary. |
| Predicted trajectory | Nothing in the repository extrapolates a future value. Drift tools measure drift that already happened. |
| Anomaly type taxonomy | `module_anomaly_status` is a rate-based description, not a type classification. `MechanismType` belongs to the investigation hypothesis, not to anomaly detection. |
| Configuration endpoint | Configuration is environment-driven; no endpoint exists. |
| Engineer verdict / sign-off | The backend stores no verdict field by design. |
| Component profile binding | `ModuleProfile` is not wired into an investigation. |

The navigation distinguishes three states so that working capability is never
misrepresented as missing: `CMP` needs an open component, `INV` needs an open
investigation, `N/I` is not implemented in this backend.

## Where each product surface gets its data

Every surface reads an endpoint that already existed. No new backend route was
added for the adaptation.

| Surface | Endpoint |
| --- | --- |
| Screening Overview | `GET /readiness`, `/modules/population`, `/models`, `/investigations`, `/corpus` |
| Components | `GET /modules`, `/modules/population` |
| Component Context | `GET /modules/{id}`, `/modules/{id}/anomaly`, `/modules/population` |
| Why was this flagged? | the three above, plus `/investigations/{id}/deterministic-results` when an investigation exists |
| Lots | `GET /modules/population` |
| Telemetry | `GET /modules/{id}/telemetry` |
| Anomaly | `GET /modules/{id}/anomaly` |
| Evaluation | `GET /evaluation/{model_id}` |
| Engineering Calculations | `GET /investigations/{id}/deterministic-results` |
| Drift Analysis | `GET /investigations/{id}/deterministic-results` |
| Evidence | `GET /investigations/{id}` (evidence records), `/corpus` |
| Hypotheses | `GET /investigations/{id}` (hypothesis) |
| Report | `GET /investigations/{id}/report` |
| Provenance | `GET /investigations/{id}/provenance` |
| Pipeline Trace | `GET /investigations/{id}` (provenance entries) |
| Knowledge Base | `GET /corpus` |
| Architecture | static structural content; no runtime data |
| Pipeline Status | `GET /readiness`, `/corpus` |

`GET /investigations/{id}/deterministic-results` already existed in
`backend/api/investigations.py`; only the frontend client function for it is new.

## Knowledge base labelling

The corpus is presented as the **Engineering Reliability Knowledge Base**, not a
burn-in knowledge base, and the coverage caveat is shown on the page.

This follows the corpus's own coverage report
(`knowledge_base/reports/corpus-coverage.md`), which records that HTOL is covered
by a single document incidentally, that no corpus document reports an HTOL test
programme of its own, and that JESD22-A108 and AEC-Q101 are paywalled. Those two
standards are listed in the manifest with their real `NEEDS_MANUAL_ACCESS` status
and are **not** claimed as included. Documents that could not be obtained are
listed rather than hidden, because hiding them would overstate the corpus.

## Demonstration case framing

BurnInGuard AI is the platform; the SIH power module is the demonstration case.
Both facts are stated in the UI (`components/DemonstrationCase.tsx`) and in the
README.

The demonstration dataset is a synthetic **power-cycling** reliability dataset
(`syn-sic-pc-dev-001`). It is never relabelled as burn-in data. Because no
`test_type` field exists anywhere in the API or the artifacts, the power-cycling
nature is presented as documented demonstration context — sourced from
`docs/data-generation/synthetic-dataset-specification.md` — and never as a
telemetry field.

## Epistemic rules preserved

The adaptation does not weaken any existing guarantee:

- The epistemic registers (`lib/registers.ts`) still separate measured data,
  deterministic calculation, retrieved evidence, model reasoning, validation
  outcome, synthetic ground truth and human decision.
- A derived disposition is registered as `CALCULATION`, never as `DATA` and never
  as a prediction.
- Hypotheses remain Candidate / Supported / Contradicted / Insufficient evidence /
  Ambiguous. Nothing is labelled a confirmed failure.
- Both validation gates remain visible.
- The human engineering decision remains the final step, and no verdict is stored.
