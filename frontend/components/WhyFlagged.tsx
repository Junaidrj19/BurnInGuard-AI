import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import type { Register } from "@/lib/registers";
import type { DeterministicResult } from "@/lib/types/backend";
import type { ModuleAnomaly, ModulePopulation, ModuleSummary } from "@/lib/types/m10";

/**
 * WhyFlagged — the bridge from detection to investigation.
 *
 * HARD RULE: every line rendered here is a backend value or an arithmetic
 * restatement of backend values. There is no heuristic, no inferred cause and no
 * narrative generation. When the field a step needs is absent, the step renders
 * NOT AVAILABLE and says which producing step would supply it. Inventing a
 * plausible-sounding explanation would defeat the purpose of the section.
 *
 * Step sources:
 *   01 Observed behaviour   module-summary.parquet counts and rate
 *   02 Deterministic calc   scores vs the detector's own thresholds
 *   03 Lot comparison       GET /modules/population, plus compare_population
 *                           when an investigation ran it
 *   04 Drift / trajectory   anomalous-cycle span, plus the drift and
 *                           degradation-rate tools when an investigation ran them
 *   05 Specification bound  check_acceptance_limits only. Never inferred.
 *
 * Forward prediction is deliberately absent: nothing in the repository predicts a
 * future trajectory, so step 04 never extrapolates.
 */

const TOOL_POPULATION = "compare_population";
const TOOL_DRIFT = "calculate_drift";
const TOOL_RATE = "calculate_degradation_rate";
const TOOL_LIMITS = "check_acceptance_limits";

function findTool(
  results: readonly DeterministicResult[] | null | undefined,
  name: string,
): DeterministicResult | undefined {
  return results?.find((r) => r.tool_name === name);
}

function num(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** A numbered analytical step. `value` null renders as NOT AVAILABLE. */
function Step({
  index,
  title,
  register,
  lines,
  unavailableReason,
}: {
  index: string;
  title: string;
  register: Register;
  lines: ReadonlyArray<{ label: string; value: string | null }>;
  /** Shown when every line is null. Must name the producing step. */
  unavailableReason?: string;
}) {
  const available = lines.some((l) => l.value !== null);

  return (
    <div className="flex gap-[var(--ss-space-3)] border-t border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-3)] first:border-t-0">
      <span
        className="ss-mono shrink-0 text-[var(--ss-text-muted)]"
        style={{ fontSize: "var(--ss-text-label-size)" }}
        aria-hidden="true"
      >
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--ss-space-2)]">
        <div className="flex items-center justify-between gap-[var(--ss-space-2)]">
          <span className="font-medium text-[var(--ss-text-primary)]">{title}</span>
          <RegisterBadge register={register} />
        </div>

        {available ? (
          <dl className="grid grid-cols-1 gap-x-[var(--ss-space-4)] gap-y-[var(--ss-space-1)] sm:grid-cols-2">
            {lines
              .filter((l) => l.value !== null)
              .map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-[var(--ss-space-2)]">
                  <dt className="ss-field-label">{l.label}</dt>
                  <dd className="ss-mono text-[var(--ss-text-primary)]">{l.value}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <div className="flex flex-col gap-[var(--ss-space-1)]">
            <span className="ss-field-label text-[var(--ss-text-muted)]">NOT AVAILABLE</span>
            {unavailableReason && (
              <span
                className="text-[var(--ss-text-muted)]"
                style={{
                  fontSize: "var(--ss-text-label-size)",
                  maxWidth: "var(--ss-measure-prose)",
                }}
              >
                {unavailableReason}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function WhyFlagged({
  summary,
  anomaly,
  population,
  deterministicResults,
}: {
  summary: ModuleSummary;
  /** Supplies the detector's own thresholds. */
  anomaly?: ModuleAnomaly | null;
  /** Supplies real lot-level counts. */
  population?: ModulePopulation | null;
  /** Present only when an investigation has run for this component. */
  deterministicResults?: readonly DeterministicResult[] | null;
}) {
  const lot = summary.lot_id;
  const lotStatuses = lot ? population?.by_lot_and_status?.[lot] : undefined;
  const lotTotal = lot ? population?.by_lot?.[lot] : undefined;

  const pop = findTool(deterministicResults, TOOL_POPULATION);
  const drift = findTool(deterministicResults, TOOL_DRIFT);
  const rate = findTool(deterministicResults, TOOL_RATE);
  const limits = findTool(deterministicResults, TOOL_LIMITS);

  const popOut = (pop?.output ?? {}) as Record<string, unknown>;
  const driftOut = (drift?.output ?? {}) as Record<string, unknown>;
  const rateOut = (rate?.output ?? {}) as Record<string, unknown>;
  const limitsOut = (limits?.output ?? {}) as Record<string, unknown>;

  return (
    <Panel>
      <SectionHeader
        title="Why was this component flagged?"
        subtitle="Each step is a backend value or a restatement of backend values. Steps whose source did not run are marked NOT AVAILABLE rather than estimated."
      />

      <Step
        index="01"
        title="Observed behaviour"
        register="DATA"
        lines={[
          { label: "observations", value: num(summary.n_observations) },
          { label: "flagged observations", value: num(summary.n_anomalous_observations) },
          { label: "anomaly_rate", value: num(summary.anomaly_rate) },
          { label: "module_anomaly_status", value: summary.module_anomaly_status ?? null },
        ]}
        unavailableReason="No module summary row exists for this component. Produced by scripts/score_anomaly.py."
      />

      <Step
        index="02"
        title="Deterministic engineering calculation"
        register="CALCULATION"
        lines={[
          { label: "max_anomaly_score", value: num(summary.max_anomaly_score) },
          { label: "mean_anomaly_score", value: num(summary.mean_anomaly_score) },
          {
            label: "observation_threshold",
            value: num(anomaly?.thresholds?.observation_threshold),
          },
          { label: "module_threshold", value: num(anomaly?.thresholds?.module_threshold) },
          {
            label: "statistical_baseline_max",
            value: num(summary.statistical_baseline_max),
          },
          {
            label: "statistical_baseline_flag_rate",
            value: num(summary.statistical_baseline_flag_rate),
          },
        ]}
        unavailableReason="Detector scores and thresholds are unavailable. Produced by scripts/train_anomaly_model.py and scripts/score_anomaly.py."
      />

      <Step
        index="03"
        title="Lot comparison"
        register={pop ? "CALCULATION" : "DATA"}
        lines={[
          { label: "lot_id", value: lot ?? null },
          { label: "components in lot", value: num(lotTotal) },
          { label: "lot · clean", value: num(lotStatuses?.["clean"]) },
          { label: "lot · sporadic", value: num(lotStatuses?.["sporadic"]) },
          { label: "lot · persistent", value: num(lotStatuses?.["persistent"]) },
          { label: "compare_population · z_score", value: num(popOut["z_score"]) },
          { label: "compare_population · deviation_pct", value: num(popOut["deviation_pct"]) },
          { label: "compare_population · module_mean", value: num(popOut["module_mean"]) },
          { label: "compare_population · reference_mean", value: num(popOut["reference_mean"]) },
        ]}
        unavailableReason="No lot recorded for this component and no population comparison has been run."
      />

      <Step
        index="04"
        title="Drift and temporal behaviour"
        register={drift || rate ? "CALCULATION" : "DATA"}
        lines={[
          { label: "first_anomalous_cycle", value: num(summary.first_anomalous_cycle) },
          { label: "last_anomalous_cycle", value: num(summary.last_anomalous_cycle) },
          { label: "anomalous_cycle_span", value: num(summary.anomalous_cycle_span) },
          { label: "calculate_drift · absolute_drift", value: num(driftOut["absolute_drift"]) },
          { label: "calculate_drift · percent_drift", value: num(driftOut["percent_drift"]) },
          {
            label: "calculate_degradation_rate · degradation_rate",
            value: num(rateOut["degradation_rate"]),
          },
          {
            label: "calculate_degradation_rate · units",
            value: typeof rateOut["units"] === "string" ? (rateOut["units"] as string) : null,
          },
        ]}
        unavailableReason="No anomalous cycle was recorded and no drift tool has been run for this component."
      />

      <Step
        index="05"
        title="Specification boundary"
        register="CALCULATION"
        lines={[
          { label: "check_acceptance_limits · n_violations", value: num(limitsOut["n_violations"]) },
          {
            label: "limit source",
            value: limits ? String(limits.provenance?.["source"] ?? "not recorded") : null,
          },
          { label: "tool_version", value: limits?.tool_version ?? null },
        ]}
        unavailableReason="Acceptance limits are evaluated only during an investigation, and check_acceptance_limits has not run for this component. No specification margin is inferred."
      />

      <div className="border-t border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-3)]">
        <p
          className="text-[var(--ss-text-muted)]"
          style={{
            fontSize: "var(--ss-text-label-size)",
            maxWidth: "var(--ss-measure-prose)",
          }}
        >
          Forward trajectory prediction is not implemented. Nothing in this system
          extrapolates a future value, so no predicted crossing of a specification
          boundary is shown.
        </p>
      </div>
    </Panel>
  );
}
