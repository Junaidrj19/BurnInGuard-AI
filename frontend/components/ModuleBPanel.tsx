import { Panel, SectionHeader } from "@/components/Panel";
import { MetricValue } from "@/components/MetricValue";
import type { ModuleBPredictionResponse } from "@/lib/types/backend";
import {
  TERM_POST_HOC_EVALUATION,
  TERM_POST_HOC_EVALUATION_PREDICTION_NOTE,
} from "@/lib/domain/terminology";

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-2)] last:border-b-0">
      <span className="text-[var(--ss-text-secondary)] ss-field-label">{label}</span>
      <span className="font-mono text-[var(--ss-text-primary)]">
        {value === null || value === undefined ? "N/I" : String(value)}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--ss-border-subtle)]" style={{ borderRadius: "var(--ss-radius-md)" }}>
      <SectionHeader title={title} level={3} />
      <div className="py-[var(--ss-space-2)]">{children}</div>
    </div>
  );
}

export function ModuleBPanel({
  data,
}: {
  data: ModuleBPredictionResponse | null;
}) {
  if (!data) {
    return (
      <Panel className="p-[var(--ss-space-4)]">
        <p className="text-[var(--ss-text-muted)]">Component projection is not available.</p>
      </Panel>
    );
  }

  const { prediction, ground_truth, evaluation, safety } = data;

  const safetyProvenance = safety.provenance && typeof safety.provenance === "object"
    ? (safety.provenance as Record<string, unknown>)
    : null;

  return (
    <Panel>
      <SectionHeader
        title="Component Projection"
        subtitle="Forward estimate of the component parameter based on observed early-life data."
        level={2}
      />

      <div className="grid grid-cols-1 gap-[var(--ss-space-4)] p-[var(--ss-space-4)] lg:grid-cols-2">
        {/* Data panel */}
        <Section title="Data">
          <Row
            label="RDS_on @ 0 h (cycle 0)"
            value={`${prediction.features["RDS_on@0"]} mOhm`}
          />
          <Row
            label="RDS_on @ 24 h (cycle 14400)"
            value={`${prediction.features["RDS_on@14400"]} mOhm`}
          />
        </Section>

        {/* Calculation panel */}
        <Section title="CALCULATION">
          <Row
            label="Predicted terminal RDS_on @ 166.7 h (cycle 100000)"
            value={`${prediction.predicted_terminal_rds_on_mohm} mOhm`}
          />
        </Section>

        {/* Post-hoc evaluation value panel */}
        <Section title={TERM_POST_HOC_EVALUATION.toUpperCase()}>
          <Row
            label="Actual terminal RDS_on @ 166.7 h (cycle 100000)"
            value={
              ground_truth.actual_terminal_rds_on_mohm !== null
                ? `${ground_truth.actual_terminal_rds_on_mohm} mOhm`
                : null
            }
          />
          <Row
            label="Evaluation note"
            value={TERM_POST_HOC_EVALUATION_PREDICTION_NOTE}
          />
        </Section>

        {/* Evaluation panel */}
        <Section title="EVALUATION">
          <Row
            label="Prediction error"
            value={evaluation.absolute_error !== null ? `${evaluation.absolute_error} mOhm` : null}
          />
          <Row label="Population MAE" value={`${evaluation.population_mae} mOhm`} />
          <Row label="Naive baseline MAE" value={`${evaluation.naive_baseline_mae} mOhm`} />
        </Section>

        {/* Safety / drift panel */}
        <Section title="SAFETY & DRIFT">
          <Row
            label="Predicted drift rate"
            value={
              safety.predicted_drift_rate_pct_per_hour !== null
                ? `${safety.predicted_drift_rate_pct_per_hour} %/h`
                : null
            }
          />
          <Row
            label="Safety slope"
            value={
              safety.safety_slope_pct_per_hour !== null
                ? `${safety.safety_slope_pct_per_hour} %/h`
                : null
            }
          />
          <Row
            label="Predicted total relative change"
            value={
              safety.predicted_total_relative_change_pct !== null
                ? `${safety.predicted_total_relative_change_pct} %`
                : null
            }
          />
          <Row label="Early reject" value={safety.early_reject === null ? null : safety.early_reject ? "YES" : "No"} />
          {safetyProvenance && (
            <>
              <Row
                label="Profile: max relative change"
                value={`${String(safetyProvenance.maximum_relative_change_percent ?? "N/I")} %`}
              />
              <Row
                label="Profile: max absolute"
                value={`${String(safetyProvenance.maximum_absolute_mohm ?? "N/I")} mOhm`}
              />
            </>
          )}
        </Section>

        {/* Horizon disclosure */}
        <Section title="HORIZON">
          <Row label="Feature cycles" value={data.horizon.feature_cycles.join(", ")} />
          <Row label="Feature hours" value={data.horizon.feature_hours.join(", ")} />
          <Row label="Target cycle" value={String(data.horizon.target_cycle)} />
          <Row label="Target hours" value={`${data.horizon.target_hours} h`} />
          <Row label="PS limitation" value={data.horizon.ps_states_168h} />
        </Section>
      </div>
    </Panel>
  );
}