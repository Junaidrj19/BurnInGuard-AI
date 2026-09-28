import { Panel, SectionHeader } from "@/components/Panel";
import { MetricValue } from "@/components/MetricValue";
import { RegisterBadge } from "@/components/RegisterValue";
import { StatusChip } from "@/components/StatusChip";
import { BASELINE_SIGNALS } from "@/lib/types/backend";
import type { ModuleAnomaly, ModuleSummary } from "@/lib/types/m10";
import { TERM_POST_HOC_EVALUATION_DETECTOR_NOTE } from "@/lib/domain/terminology";

/**
 * ModuleAExplainability (SIH Part 7).
 *
 * "Why was this component flagged?" — a deterministic evidence panel, not LLM prose.
 * Every line is a backend value from the frozen M7 artifacts.
 *
 * It does NOT name a single "responsible signal": the Isolation Forest operates over all
 * input features and the M8 artifacts do not attribute the decision to one signal, so
 * claiming one would be fabricated. The real signal set and the real statistical
 * baseline max deviation are shown instead.
 *
 * When the module has no flagged observation the panel reports that the part is NOT
 * anomalous, with the anomaly score against the module threshold.
 */
export function ModuleAExplainability({
  anomaly,
  summary,
  groundTruth,
}: {
  anomaly: ModuleAnomaly | null;
  /** The raw module summary, which carries the scores. */
  summary: ModuleSummary | null;
  /** Ground-truth fields from module_evaluation, evaluation-only. */
  groundTruth?: Record<string, unknown>;
}) {
  return (
    <Panel>
      <SectionHeader
        title="Explanability — why this component was flagged"
        subtitle="Deterministic evidence from the frozen M7 detector. It justifies its screening to a QA inspector rather than acting as a black box."
      />

      <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-3">
          <MetricValue
            label="Signal group"
            value={BASELINE_SIGNALS.join(", ")}
            register="DATA"
          />
          <MetricValue
            label="max |robust normalised deviation|"
            value={summary?.statistical_baseline_max}
            register="CALCULATION"
            note={`independent statistical comparator max across the ${BASELINE_SIGNALS.length} baseline signals`}
          />
          <MetricValue
            label="module_anomaly_status"
            value={summary?.module_anomaly_status}
            register="CALCULATION"
          />
        </div>

        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-3">
          <MetricValue
            label="max_anomaly_score"
            value={summary?.max_anomaly_score}
            register="DATA"
            note="higher = more anomalous"
          />
          <MetricValue
            label="anomaly_rate"
            value={summary?.anomaly_rate}
            register="CALCULATION"
            note={`${summary?.n_anomalous_observations ?? "—"} of ${summary?.n_observations ?? "—"} observations flagged`}
          />
          <MetricValue
            label="module_threshold"
            value={anomaly?.thresholds?.module_threshold}
            register="CALCULATION"
            note="module-level decision boundary"
          />
        </div>

        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-3">
          <MetricValue
            label="Temporal window"
            value={
              summary?.first_anomalous_cycle != null
                ? `cycle ${summary.first_anomalous_cycle} → ${summary.last_anomalous_cycle ?? "—"}`
                : null
            }
            register="DATA"
          />
          <MetricValue
            label="anomalous_cycle_span"
            value={summary?.anomalous_cycle_span}
            register="CALCULATION"
            note="persistence over the stress history"
          />
          <MetricValue
            label="statistical_baseline_flag_rate"
            value={summary?.statistical_baseline_flag_rate}
            register="CALCULATION"
          />
        </div>

        <div className="flex flex-wrap items-center gap-[var(--ss-space-2)] border-t border-[var(--ss-border-subtle)] pt-[var(--ss-space-3)]">
          <span className="ss-field-label">Decision</span>
          <StatusChip status={summary?.module_anomaly_status} />
        </div>

        {groundTruth && Object.keys(groundTruth).length > 0 && (
          <div
            className="ss-hatch grid grid-cols-1 gap-[var(--ss-space-4)] border p-[var(--ss-space-3)] lg:grid-cols-4"
            style={{
              borderColor: "var(--ss-reg-groundtruth-border)",
              borderRadius: "var(--ss-radius-sm)",
            }}
          >
            <div className="lg:col-span-4">
              <RegisterBadge register="GROUND_TRUTH" />
              <p
                className="mt-[var(--ss-space-1)] text-[var(--ss-text-muted)]"
                style={{ fontSize: "var(--ss-text-label-size)" }}
              >
                {TERM_POST_HOC_EVALUATION_DETECTOR_NOTE} Engineering interpretation is NOT derived from these labels.
              </p>
            </div>
            {groundTruth["health_state"] != null && (
              <MetricValue label="health_state (truth)" value={String(groundTruth["health_state"])} register="GROUND_TRUTH" />
            )}
            {groundTruth["degradation_mechanism"] != null && (
              <MetricValue label="degradation_mechanism (truth)" value={String(groundTruth["degradation_mechanism"])} register="GROUND_TRUTH" />
            )}
            {groundTruth["degradation_stage"] != null && (
              <MetricValue label="degradation_stage (truth)" value={String(groundTruth["degradation_stage"])} register="GROUND_TRUTH" />
            )}
            {groundTruth["y_true"] != null && (
              <MetricValue label="y_true (truth)" value={Boolean(groundTruth["y_true"])} register="GROUND_TRUTH" />
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
