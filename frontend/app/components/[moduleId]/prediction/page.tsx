import Link from "next/link";
import { getModulePrediction } from "@/lib/api/endpoints";
import { ModuleBPanel } from "@/components/ModuleBPanel";
import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { ErrorState } from "@/components/ErrorState";
import { TERM_POST_HOC_EVALUATION_PREDICTION_NOTE } from "@/lib/domain/terminology";

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between border-b border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-2)] last:border-b-0">
      <span className="text-[var(--ss-text-secondary)] ss-field-label">{label}</span>
      <span className="ss-mono text-[var(--ss-text-primary)]">
        {value === null || value === undefined ? "N/I" : String(value)}
      </span>
    </div>
  );
}

function Explainability() {
  return (
    <Panel>
      <SectionHeader
        level={3}
        title="How the projection was made"
        subtitle="Component projection explainability — inputs, model, output, evaluation, safety and provenance."
        actions={<RegisterBadge register="CALCULATION" />}
      />
      <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-2">
          <div className="flex flex-col gap-[var(--ss-space-2)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">INPUTS</span>
            <Row label="RDS_on @ 0 h" value="cycle 0" />
            <Row label="RDS_on @ 24 h" value="cycle 14400" />
          </div>
          <div className="flex flex-col gap-[var(--ss-space-2)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">MODEL</span>
            <Row label="Preprocessing" value="StandardScaler" />
            <Row label="Estimator" value="Ridge" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-[var(--ss-space-4)] lg:grid-cols-2">
          <div className="flex flex-col gap-[var(--ss-space-2)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">OUTPUT</span>
            <p className="px-[var(--ss-space-4)] text-[var(--ss-text-secondary)]">
              Predicted terminal RDS_on @ 166.7 h (cycle 100000)
            </p>
          </div>
          <div className="flex flex-col gap-[var(--ss-space-2)]">
            <span className="ss-field-label text-[var(--ss-text-primary)]">PROVENANCE</span>
            <Row label="Feature cycles" value="0, 14400" />
            <Row label="Target cycle" value="100000" />
            <Row label="Acceptance reference" value="sic-reference-module.json" />
          </div>
        </div>
        <p
          className="px-[var(--ss-space-4)] text-[var(--ss-text-muted)]"
          style={{ fontSize: "var(--ss-text-label-size)", maxWidth: "var(--ss-measure-prose)" }}
        >
          {TERM_POST_HOC_EVALUATION_PREDICTION_NOTE}
        </p>
      </div>
    </Panel>
  );
}

export default async function PredictionPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const result = await getModulePrediction(moduleId);

  if (result.kind !== "ok") {
    return (
      <div className="p-[var(--ss-space-4)]">
        <ErrorState result={result} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--ss-space-4)]">
      <Panel className="border-0 bg-transparent p-0">
        <p
          className="text-[var(--ss-text-muted)]"
          style={{ maxWidth: "var(--ss-measure-prose)" }}
        >
          Forward estimate of the component parameter based on observed early-life data.
          This is separate from the observed anomaly: anomaly detection flags what was observed;
          component projection estimates a future trajectory. Prediction does not cause an anomaly flag.
        </p>
        <p
          className="mt-[var(--ss-space-2)] text-[var(--ss-text-muted)]"
          style={{ maxWidth: "var(--ss-measure-prose)" }}
        >
          PS specifies 168&nbsp;h; the supplied dataset ends at 166.67&nbsp;h. No
          extrapolation is performed. The predicted terminal value is a cycle-100000 (166.7&nbsp;h)
          estimate, not a literal 168&nbsp;h measurement.
        </p>
        <Link
          href={`/components/${moduleId}/anomaly`}
          className="mt-[var(--ss-space-3)] inline-block ss-field-label text-[var(--ss-accent)] hover:underline"
        >
          View observed anomaly →
        </Link>
      </Panel>
      <Explainability />
      <ModuleBPanel data={result.data} />
    </div>
  );
}