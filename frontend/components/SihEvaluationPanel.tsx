import { Panel, SectionHeader } from "@/components/Panel";
import { MetricValue } from "@/components/MetricValue";
import { RegisterBadge } from "@/components/RegisterValue";
import { StatusChip } from "@/components/StatusChip";
import { BASELINE_SIGNALS } from "@/lib/types/backend";
import type { EvaluationSummary, ModuleLevelMetrics } from "@/lib/types/m10";
import type { ModuleBEvaluationResponse } from "@/lib/types/backend";

/**
 * SihEvaluationPanel (SIH Part 9).
 *
 * Three SIH evaluation criteria displayed as three compact columns:
 *
 *   01  ANOMALY DETECTION   — F1, recall, false negatives, component anomaly score
 *   02  COMPONENT PROJECTION — MAE, naive baseline, improvement, test-set size
 *   03  EXPLAINABILITY      — deterministic evidence, observed signals, safety
 *
 * Built from real frozen artifacts only. No fabricated metrics.
 * When evaluation data is absent, the relevant cell renders N/I with a reason.
 */
export function SihEvaluationPanel({
  anomalyEval,
  driftEval,
  componentAnomalyScore,
  componentAnomalyStatus,
}: {
  anomalyEval: EvaluationSummary | null;
  driftEval: ModuleBEvaluationResponse | null;
  componentAnomalyScore: number | null | undefined;
  componentAnomalyStatus: string | null | undefined;
}) {
  const overall: Partial<ModuleLevelMetrics> = anomalyEval?.module_level_metrics ?? {};
  const testRaw = anomalyEval?.m7_test_lot_compatibility as unknown as Record<string, unknown> | undefined;
  const testLot = (testRaw?.["metrics"] ?? testRaw) as unknown as Partial<ModuleLevelMetrics> | undefined;

  return (
    <Panel>
      <SectionHeader
        title="SIH evaluation metrics"
        subtitle="Three criteria the problem statement evaluates. Every number traces to a frozen artifact."
        actions={<RegisterBadge register="CALCULATION" />}
      />
      <div className="grid grid-cols-1 gap-[var(--ss-space-4)] p-[var(--ss-space-4)] lg:grid-cols-3">
        {/* 01 — ANOMALY DETECTION */}
        <div className="flex flex-col gap-[var(--ss-space-3)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
          <span className="ss-field-label" style={{ color: "var(--ss-accent)" }}>
            01 · Anomaly detection
          </span>
          <div className="flex items-center gap-[var(--ss-space-2)]">
            <StatusChip status={componentAnomalyStatus} />
          </div>
          {anomalyEval ? (
            <div className="grid grid-cols-2 gap-[var(--ss-space-2)]">
              <MetricValue label="Detection F1" value={format(overall.f1)} register="CALCULATION" />
              <MetricValue label="Recall" value={pct(overall.recall)} register="CALCULATION" />
              <MetricValue label="False negatives" value={overall.fn} register="CALCULATION" />
              <MetricValue label="False positives" value={overall.fp} register="CALCULATION" />
            </div>
          ) : (
            <span className="text-[var(--ss-text-muted)] ss-field-label">N/I — evaluation artifact absent</span>
          )}
          <MetricValue
            label="Component anomaly score"
            value={componentAnomalyScore}
            register="DATA"
            note="per-component max anomaly score"
          />
        </div>

        {/* 02 — DRIFT PREDICTION */}
        <div className="flex flex-col gap-[var(--ss-space-3)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
          <span className="ss-field-label" style={{ color: "var(--ss-accent)" }}>
            02 · Component projection
          </span>
          {driftEval ? (
            <div className="grid grid-cols-2 gap-[var(--ss-space-2)]">
              <MetricValue label="MAE" value={driftEval.mae} unit="mOhm" register="CALCULATION" />
              <MetricValue label="Naive baseline" value={driftEval.naive_mae} unit="mOhm" register="CALCULATION" />
              <MetricValue label="Improvement" value={driftEval.improvement != null ? `${driftEval.improvement.toFixed(2)}%` : null} register="CALCULATION" />
              <MetricValue label="Test-set size" value={driftEval.n_test} register="DATA" />
            </div>
          ) : (
            <span className="text-[var(--ss-text-muted)] ss-field-label">N/I — Component projection artifact absent</span>
          )}
          <span className="text-[var(--ss-text-muted)] ss-field-label">lower MAE is better</span>
        </div>

        {/* 03 — EXPLAINABILITY */}
        <div className="flex flex-col gap-[var(--ss-space-3)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
          <span className="ss-field-label" style={{ color: "var(--ss-accent)" }}>
            03 · Explainability
          </span>
          <div className="grid grid-cols-2 gap-[var(--ss-space-2)]">
            <span className="ss-field-label text-[var(--ss-text-secondary)]">Anomaly evidence</span>
            <span className="ss-mono text-[var(--ss-text-primary)]">
              {componentAnomalyStatus ? "available" : "N/I"}
            </span>
            <span className="ss-field-label text-[var(--ss-text-secondary)]">Observed signals</span>
            <span className="ss-mono text-[var(--ss-text-primary)]">{BASELINE_SIGNALS.length}</span>
            <span className="ss-field-label text-[var(--ss-text-secondary)]">Anomaly reason</span>
            <span className="ss-mono text-[var(--ss-text-primary)]">{componentAnomalyStatus ?? "N/I"}</span>
            <span className="ss-field-label text-[var(--ss-text-secondary)]">Prediction transparency</span>
            <span className="ss-mono text-[var(--ss-text-primary)]">
              {driftEval ? "StandardScaler → Ridge" : "N/I"}
            </span>
            <span className="ss-field-label text-[var(--ss-text-secondary)]">Safety provenance</span>
            <span className="ss-mono text-[var(--ss-text-primary)]">sic-reference-module.json</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function format(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function pct(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : null;
}