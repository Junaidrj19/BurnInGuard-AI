/**
 * Screening disposition — BurnInGuard AI product vocabulary.
 *
 * WHAT THIS IS
 * ------------
 * A PRESENTATION-LAYER derivation over a value the backend already computed. It
 * introduces no threshold, no model, and no prediction. Given the existing
 * `module_anomaly_status`, it selects a product label and carries the derivation
 * with it so the UI can show an engineer exactly where the label came from.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a backend field. Not a failure verdict. Not a prediction. Not a release,
 * reject or certification decision — `agent-rules.md` reserves component
 * disposition authority for the engineer, and the backend deliberately stores no
 * verdict (design.md §20.6).
 *
 * SOURCE OF TRUTH
 * ---------------
 * `module_anomaly_status` is assigned in `ml/anomaly/aggregate.py`:
 *
 *   clean       no observation was flagged by the detector
 *   sporadic    anomaly_rate < ANOMALY_RATE_SPORADIC_CUTOFF  (0.1, aggregate.py:13)
 *   persistent  anomaly_rate >= ANOMALY_RATE_SPORADIC_CUTOFF
 *
 * That cutoff is pre-existing backend semantics. This module references it and
 * does not define, alter or extend it.
 *
 * EARLY REJECT
 * ------------
 * Deliberately NOT derivable from anomaly status. It is emitted only when an
 * investigation actually recorded a `check_acceptance_limits` violation against
 * the module profile's acceptance limits. With no investigation, or with zero
 * violations, it is never shown. An anomaly alone can never produce it.
 */

import type { DeterministicResult } from "@/lib/types/backend";

export type Disposition = "PASS" | "MONITOR" | "FLAG" | "EARLY_REJECT";

/** The exact tool name registered in backend/agents/investigation/tools/registry.py. */
const LIMITS_TOOL = "check_acceptance_limits";

/**
 * A disposition together with its provenance. Every field is rendered by
 * `components/DispositionChip.tsx` so the derivation is visible, not implied.
 */
export interface DispositionDerivation {
  /** Null when the source value is absent or unrecognised. Never guessed. */
  readonly disposition: Disposition | null;
  /** The backend field the disposition was derived from. */
  readonly sourceField: string;
  /** The backend value, verbatim. */
  readonly sourceValue: string | null;
  /** Human-readable derivation rule, naming the producing backend module. */
  readonly rule: string;
  /** True when the source value was missing or not recognised. */
  readonly unknown: boolean;
  /** Present only when EARLY_REJECT was produced by a real limit violation. */
  readonly limitViolations?: number;
}

const ANOMALY_STATUS_RULE =
  "Derived from module_anomaly_status, assigned by ml/anomaly/aggregate.py: clean when no observation is flagged, sporadic below the existing anomaly-rate cutoff (0.1), persistent at or above it.";

const EARLY_REJECT_RULE =
  "Derived from a recorded check_acceptance_limits violation against the module profile acceptance limits. Anomaly status alone never produces this disposition.";

/** Product label for each disposition. */
export const DISPOSITION_LABEL: Readonly<Record<Disposition, string>> = {
  PASS: "PASS",
  MONITOR: "MONITOR",
  FLAG: "FLAG",
  EARLY_REJECT: "EARLY REJECT",
};

/**
 * What each disposition means in product terms. Phrased to avoid implying a
 * confirmed physical failure at any level.
 */
export const DISPOSITION_MEANING: Readonly<Record<Disposition, string>> = {
  PASS: "No observation exceeded the detector threshold during this stress run.",
  MONITOR:
    "Isolated flagged observations. Below the anomaly-rate cutoff that the detector treats as persistent.",
  FLAG:
    "Flagged observations at or above the anomaly-rate cutoff. Warrants engineering investigation; not a confirmed failure.",
  EARLY_REJECT:
    "A measured value fell outside the module profile acceptance limits during an investigation. Engineering review required.",
};

/**
 * Maps the existing anomaly status onto the product disposition.
 *
 * An unrecognised status returns `disposition: null` with `unknown: true`, so a
 * future backend enum member can never be silently presented as PASS. This
 * mirrors the same decision made by `statusDescriptor` in lib/copy/status.ts.
 */
export function dispositionFromAnomalyStatus(
  status: string | null | undefined,
): DispositionDerivation {
  const base = {
    sourceField: "module_anomaly_status",
    sourceValue: status ?? null,
    rule: ANOMALY_STATUS_RULE,
  };

  switch (status) {
    case "clean":
      return { ...base, disposition: "PASS", unknown: false };
    case "sporadic":
      return { ...base, disposition: "MONITOR", unknown: false };
    case "persistent":
      return { ...base, disposition: "FLAG", unknown: false };
    default:
      return { ...base, disposition: null, unknown: true };
  }
}

/**
 * Finds a real acceptance-limit violation in an investigation's deterministic
 * results. Returns null when the tool did not run, so "not run" and "ran with no
 * violation" stay distinguishable.
 */
export function acceptanceLimitViolations(
  results: readonly DeterministicResult[] | null | undefined,
): { readonly ran: boolean; readonly nViolations: number } | null {
  if (!results || results.length === 0) return null;
  const runs = results.filter((r) => r.tool_name === LIMITS_TOOL);
  if (runs.length === 0) return null;

  let total = 0;
  for (const r of runs) {
    const n = (r.output as Record<string, unknown> | null | undefined)?.["n_violations"];
    if (typeof n === "number" && Number.isFinite(n)) total += n;
  }
  return { ran: true, nViolations: total };
}

/**
 * The screening disposition for a component.
 *
 * `results` is optional because acceptance limits are only evaluated inside an
 * investigation. Without them the function returns the anomaly-status mapping
 * unchanged — it never assumes limits were satisfied, and it never assumes they
 * were violated.
 */
export function screeningDisposition(
  status: string | null | undefined,
  results?: readonly DeterministicResult[] | null,
): DispositionDerivation {
  const limits = acceptanceLimitViolations(results);
  if (limits && limits.nViolations > 0) {
    return {
      disposition: "EARLY_REJECT",
      sourceField: `${LIMITS_TOOL}.n_violations`,
      sourceValue: String(limits.nViolations),
      rule: EARLY_REJECT_RULE,
      unknown: false,
      limitViolations: limits.nViolations,
    };
  }
  return dispositionFromAnomalyStatus(status);
}

/**
 * Aggregates the real per-status population counts from `GET /modules/population`
 * into disposition counts.
 *
 * EARLY_REJECT is intentionally excluded: it requires per-investigation limit
 * results, which a population count does not contain. Reporting it as zero would
 * assert that no component violated its limits, which this data cannot support.
 */
export function dispositionCounts(
  byAnomalyStatus: Readonly<Record<string, number>> | null | undefined,
): {
  readonly counts: ReadonlyArray<{ disposition: Disposition; count: number; sourceValue: string }>;
  readonly unmapped: ReadonlyArray<{ sourceValue: string; count: number }>;
} {
  const counts: Array<{ disposition: Disposition; count: number; sourceValue: string }> = [];
  const unmapped: Array<{ sourceValue: string; count: number }> = [];
  if (!byAnomalyStatus) return { counts, unmapped };

  for (const [sourceValue, count] of Object.entries(byAnomalyStatus)) {
    const d = dispositionFromAnomalyStatus(sourceValue).disposition;
    if (d) counts.push({ disposition: d, count, sourceValue });
    else unmapped.push({ sourceValue, count });
  }

  const order: Disposition[] = ["PASS", "MONITOR", "FLAG", "EARLY_REJECT"];
  counts.sort((a, b) => order.indexOf(a.disposition) - order.indexOf(b.disposition));
  return { counts, unmapped };
}
