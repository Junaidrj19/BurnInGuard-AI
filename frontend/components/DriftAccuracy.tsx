import { Panel, SectionHeader } from "@/components/Panel";
import { MetricValue } from "@/components/MetricValue";
import { RegisterBadge } from "@/components/RegisterValue";
import type { ModuleBEvaluationResponse } from "@/lib/types/backend";

/**
 * DriftAccuracy (SIH Part 6).
 *
 * Presents component projection held-out evaluation accuracy. Every
 * number comes from /prediction/evaluation which reads from the frozen
 * module-b-record.json.
 *
 * "Lower MAE is better" is explicit. Improvement vs naive baseline is calculated
 * from the actual values.
 */
export function DriftAccuracy({
  evaluation,
}: {
  evaluation: ModuleBEvaluationResponse | null;
}) {
  if (!evaluation) {
    return (
      <Panel>
        <SectionHeader
          title="Component projection accuracy"
          subtitle="Component projection held-out evaluation."
        />
        <div className="p-[var(--ss-space-4)]">
          <p className="text-[var(--ss-text-muted)]">
            Component projection evaluation artifact is unavailable.
          </p>
        </div>
      </Panel>
    );
  }

  const { mae, naive_mae, improvement, split } = evaluation;
  const trainLots = split?.train_lots ? (split.train_lots as string[]).join(", ") : "N/I";
  const testLots = split?.test_lots ? (split.test_lots as string[]).join(", ") : "N/I";

  return (
    <Panel>
      <SectionHeader
        title="Component projection accuracy"
        subtitle="Component projection held-out evaluation. Lower MAE is better."
        actions={<RegisterBadge register="CALCULATION" />}
      />
      <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-2">
          <div className="flex flex-col gap-[var(--ss-space-3)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">Primary metric</span>
            <MetricValue label="MAE" value={mae} unit="mOhm" register="CALCULATION" />
          </div>
          <div className="flex flex-col gap-[var(--ss-space-3)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">Baseline</span>
            <MetricValue
              label="Naive MAE"
              value={naive_mae}
              unit="mOhm"
              register="CALCULATION"
              note={`Naive prediction uses ${evaluation.features?.[0] ?? "first-feature"} as the terminal estimate.`}
            />
          </div>
        </div>

        <MetricValue
          label="Improvement over naive"
          value={improvement != null ? `${improvement.toFixed(2)}%` : null}
          register="CALCULATION"
          note={
            improvement != null
              ? `Model reduces MAE by ${improvement.toFixed(2)}% vs the naive baseline.`
              : undefined
          }
        />

        <div className="grid grid-cols-2 gap-[var(--ss-space-4)] border-t border-[var(--ss-border-subtle)] pt-[var(--ss-space-3)] lg:grid-cols-4">
          <MetricValue label="n_train" value={evaluation.n_train} register="DATA" />
          <MetricValue label="n_test" value={evaluation.n_test} register="DATA" />
          <MetricValue label="Train lots" value={trainLots} register="DATA" />
          <MetricValue label="Test lots" value={testLots} register="DATA" />
        </div>

        <p
          className="text-[var(--ss-text-muted)]"
          style={{ fontSize: "var(--ss-text-label-size)", maxWidth: "var(--ss-measure-prose)" }}
        >
          The current improvement is modest — the Ridge model reduces MAE by {improvement?.toFixed(2) ?? "N/I"}% with respect to the naive
          baseline. Lower MAE is better. The model selection note states:{" "}
          {evaluation.model_selection_note}
        </p>
      </div>
    </Panel>
  );
}