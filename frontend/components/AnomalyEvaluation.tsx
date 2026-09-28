import { Panel, SectionHeader } from "@/components/Panel";
import { MetricValue } from "@/components/MetricValue";
import { StatusChip } from "@/components/StatusChip";
import { RegisterBadge } from "@/components/RegisterValue";
import type { EvaluationSummary, ModuleLevelMetrics } from "@/lib/types/m10";

/**
 * AnomalyDetectionEvaluation (SIH Parts 4 + 5).
 *
 * Presents the ANOMALY DETECTION EVALUATION: the performance of the frozen M7
 * detector against the synthetic ground-truth labels held in
 * evaluation-summary.json. Because the SIH states that a false negative (missing a
 * defective part) is catastrophic, false negatives are made explicit.
 *
 * The two populations are reported separately, never blended:
 *   overall_population           — all 750 evaluated modules
 *   m7_test_lot_compatibility  — the held-out test lots (lot-01, lot-04)
 *
 * Every number here is read verbatim from the frozen M8 evaluation artifact. It is
 * NOT the per-component anomaly score — the anomaly score is rendered separately.
 * Nothing is invented: if ground truth were absent, the SIH state is N/I.
 */
export function AnomalyEvaluation({
  summary,
}: {
  summary: EvaluationSummary | null;
}) {
  if (!summary) {
    return (
      <Panel>
        <SectionHeader
          title="Anomaly detection evaluation"
          subtitle="Performance of the anomaly detector against post-hoc evaluation labels."
        />
        <div className="p-[var(--ss-space-4)]">
          <p className="text-[var(--ss-text-muted)]">
            Post-hoc evaluation: N/I — no verified defect labels in the supplied
            evaluation artifact.
          </p>
        </div>
      </Panel>
    );
  }

  const overall = summary.module_level_metrics;
  const testRaw = summary.m7_test_lot_compatibility as unknown as Record<string, unknown>;
  const testLot = (testRaw["metrics"] ?? testRaw) as unknown as Partial<ModuleLevelMetrics>;

  return (
    <Panel>
      <SectionHeader
        title="Anomaly detection evaluation"
        subtitle="Detector performance against synthetic post-hoc evaluation labels. False negatives (missing a defective part) are shown explicitly."
        actions={<RegisterBadge register="CALCULATION" />}
      />
      <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-2">
          <PopulationBlock
            title="Overall population"
            population="all evaluated lots"
            m={overall}
          />
          <PopulationBlock
            title="Held-out test lots"
            population={testRaw["test_lots"] ? String(testRaw["test_lots"]) : "lot-01 · lot-04"}
            m={testLot}
          />
        </div>

        <MetricValue
          label="False negative is catastrophic"
          value={overall.fn !== undefined ? overall.fn : null}
          register="CALCULATION"
          note={`${overall.fn ?? "—"} of ${overall.n_positive ?? "—"} defective parts were missed by the detector in the overall population.`}
        />

        <p
          className="text-[var(--ss-text-muted)]"
          style={{ fontSize: "var(--ss-text-label-size)", maxWidth: "var(--ss-measure-prose)" }}
        >
          An anomaly is not a confirmed physical failure. These metrics describe detector
          behaviour on the evaluated frozen dataset and are not a universal accuracy claim.
        </p>
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

function PopulationBlock({
  title,
  population,
  m,
}: {
  title: string;
  population: string;
  m: Partial<ModuleLevelMetrics>;
}) {
  return (
    <div className="border border-[var(--ss-border-subtle)]" style={{ borderRadius: "var(--ss-radius-md)" }}>
      <div className="flex items-center justify-between border-b border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-3)]">
        <div className="flex flex-col gap-[var(--ss-space-1)]">
          <span className="font-medium text-[var(--ss-text-primary)]">{title}</span>
          <span className="text-[var(--ss-text-muted)] ss-field-label">{population}</span>
        </div>
        <StatusChip status={m.tp !== undefined && m.tp !== null ? "FLAGGED" : "UNKNOWN"} />
      </div>
      <div className="grid grid-cols-2 gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
        <MetricValue label="Detection score · F1" value={format(m.f1)} register="CALCULATION" />
        <MetricValue label="Recall" value={pct(m.recall)} register="CALCULATION" />
        <MetricValue
          label="False negatives · FN"
          value={m.fn}
          register="CALCULATION"
          note="missed defective parts"
        />
        <MetricValue label="False positives · FP" value={m.fp} register="CALCULATION" />
        <MetricValue label="Precision" value={pct(m.precision)} register="CALCULATION" />
        <MetricValue label="True positives · TP" value={m.tp} register="CALCULATION" />
        <MetricValue label="True negatives · TN" value={m.tn} register="CALCULATION" />
        <MetricValue label="n_components" value={m.n_modules} register="DATA" />
      </div>
    </div>
  );
}
