import Link from "next/link";
import { notFound } from "next/navigation";
import { DispositionChip } from "@/components/DispositionChip";
import { EmptyState } from "@/components/EmptyState";
import { MetricValue } from "@/components/MetricValue";
import { MonoId } from "@/components/MonoId";
import { NextAction, WorkflowStrip } from "@/components/NextAction";
import { Panel, SectionHeader, SplitPanel } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { StatusChip } from "@/components/StatusChip";
import { WhyFlagged } from "@/components/WhyFlagged";
import {
  getDeterministicResults,
  getModule,
  getModuleAnomaly,
  getModulePopulation,
  unavailable,
} from "@/lib/api/endpoints";
import { asBoolean, asNumber, asString } from "@/lib/investigation";
import { RUN_LABEL_NOTE } from "@/lib/copy/product";
import { ANOMALY_QUALIFICATION, SYNTHETIC_NOTE } from "@/lib/copy/states";
import { screeningDisposition } from "@/lib/domain/disposition";
import {
  TERM_POST_HOC_EVALUATION,
  TERM_POST_HOC_EVALUATION_DETECTOR_NOTE,
} from "@/lib/domain/terminology";

/**
 * Component Context (UX.md §6).
 *
 * Establishes the engineering object under screening. Every value carries its
 * epistemic register: identifiers and measurements are DATA, derived rates are
 * CALCULATION, and ground truth is quarantined in its own labelled register.
 *
 * The screening disposition is derived in the presentation layer from
 * `module_anomaly_status` and is rendered together with that source value, so it
 * is never mistaken for a backend prediction.
 */
export default async function ComponentContextPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const result = await getModule(moduleId);
  if (result.kind !== "ok") notFound();

  const d = result.data;
  const s = d.module_summary;
  const ev = d.module_evaluation;
  const split = d.split_membership;
  const profile = unavailable.moduleProfile<never>(moduleId);
  const latest = d.investigations.at(-1);

  // Thresholds, lot counts and — only when an investigation exists — the real
  // deterministic tool outputs that the "why was this flagged" section needs.
  // Every one of these is an existing endpoint; nothing is recomputed here.
  const [anomalyResult, populationResult, determResult] = await Promise.all([
    getModuleAnomaly(moduleId, d.model_id),
    getModulePopulation(d.model_id),
    latest ? getDeterministicResults(latest.investigation_id) : Promise.resolve(null),
  ]);

  const anomaly = anomalyResult.kind === "ok" ? anomalyResult.data : null;
  const population = populationResult.kind === "ok" ? populationResult.data : null;
  const deterministicResults =
    determResult && determResult.kind === "ok" ? determResult.data.results : null;

  const disposition = screeningDisposition(
    asString(s.module_anomaly_status),
    deterministicResults,
  );

  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title="Component Context"
          subtitle="The engineering object being screened, and the frozen detector that scored it."
          actions={<RegisterBadge register="DATA" />}
        />
        <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
          <WorkflowStrip
            current="Component"
            steps={[
              { label: "Component" },
              { label: "Signals", href: `/components/${moduleId}/signals` },
              { label: "Anomaly", href: `/components/${moduleId}/anomaly` },
              { label: "Evaluation", href: `/components/${moduleId}/evaluation` },
              { label: "Component Projection", href: `/components/${moduleId}/prediction` },
              { label: "Start Investigation", href: `/investigations/new?module_id=${moduleId}` },
            ]}
          />

          <dl className="grid grid-cols-2 gap-[var(--ss-space-4)] lg:grid-cols-4">
            <MetricValue label="Component ID" value={s.module_id} register="DATA" />
            <MetricValue
              label="Stress Run ID"
              value={s.test_id}
              register="DATA"
              note={RUN_LABEL_NOTE}
            />
            <MetricValue label="Lot" value={s.lot_id} register="DATA" />
            <MetricValue label="Dataset" value={s.dataset_id} register="DATA" />
            <MetricValue
              label="Data origin"
              value={d.data_origin.toUpperCase()}
              register="DATA"
              note={SYNTHETIC_NOTE}
            />
            <MetricValue label="Model" value={d.model.model_id} register="DATA" />
            <MetricValue label="Feature version" value={d.model.feature_version} register="DATA" />
            <MetricValue label="Detector version" value={d.model.detector_version} register="DATA" />
          </dl>

          <div className="flex flex-col gap-[var(--ss-space-2)] border-t border-[var(--ss-border-subtle)] pt-[var(--ss-space-3)]">
            <span className="ss-field-label">Screening disposition</span>
            <DispositionChip derivation={disposition} showRule />
            <div className="flex flex-wrap items-center gap-[var(--ss-space-3)]">
              <span className="ss-field-label">module_anomaly_status</span>
              <StatusChip
                status={asString(s.module_anomaly_status)}
                suffix={s.anomaly_rate !== null ? String(s.anomaly_rate) : undefined}
              />
              <span className="text-[var(--ss-text-muted)]">{ANOMALY_QUALIFICATION}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── detection → explanation bridge ──────────────────────────── */}
      <WhyFlagged
        summary={s}
        anomaly={anomaly}
        population={population}
        deterministicResults={deterministicResults}
      />

      <SplitPanel
        ratio="balanced"
        left={
          /* ── observed measurement counts ───────────────────────────── */
          <Panel>
            <SectionHeader title="Observed" subtitle="Counts and scores from the detector run." level={3} />
            <div className="grid grid-cols-2 gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
              <MetricValue label="n_observations" value={s.n_observations} register="DATA" />
              <MetricValue
                label="n_anomalous_observations"
                value={s.n_anomalous_observations}
                register="DATA"
              />
              <MetricValue label="anomaly_rate" value={s.anomaly_rate} register="CALCULATION" />
              <MetricValue
                label="max_anomaly_score"
                value={s.max_anomaly_score}
                register="DATA"
                note="higher = more anomalous"
              />
              <MetricValue label="first_anomalous_cycle" value={s.first_anomalous_cycle} register="DATA" />
              <MetricValue label="last_anomalous_cycle" value={s.last_anomalous_cycle} register="DATA" />
            </div>
          </Panel>
        }
        right={
          /* ── split membership: was this module used for training? ─── */
          <Panel>
            <SectionHeader
              title="Split membership"
              subtitle="Whether this module's lot was held out. A module from a training lot is not an independent test of the detector."
              level={3}
            />
            <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
              <div className="flex flex-wrap items-center gap-[var(--ss-space-2)]">
                <StatusChip status={split.in_test_lots ? "PASSED" : "UNKNOWN"} />
                <span className="text-[var(--ss-text-secondary)]">
                  {split.in_test_lots
                    ? "Held-out test lot — independent of training."
                    : split.in_train_lots
                      ? "Training lot — this module contributed to fitting the detector."
                      : "Lot not listed in the declared split."}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-[var(--ss-space-3)]">
                <MetricValue label="split_type" value={split.split_type} register="DATA" />
                <MetricValue label="lot_id" value={split.lot_id} register="DATA" />
                <MetricValue
                  label="train_lots"
                  value={split.train_lots.join(", ")}
                  register="DATA"
                />
                <MetricValue label="test_lots" value={split.test_lots.join(", ")} register="DATA" />
              </dl>
            </div>
          </Panel>
        }
      />

      {/* ── post-hoc evaluation value, quarantined ──────────────────── */}
      <Panel>
        <SectionHeader
          title={TERM_POST_HOC_EVALUATION}
          subtitle={TERM_POST_HOC_EVALUATION_DETECTOR_NOTE}
          level={3}
          actions={<RegisterBadge register="GROUND_TRUTH" />}
        />
        <div className="p-[var(--ss-space-4)]">
          {Object.keys(ev).length === 0 ? (
            <EmptyState state="NO_DATA" body="No evaluation row exists for this module." />
          ) : (
            <div
              className="ss-hatch flex flex-col gap-[var(--ss-space-3)] border p-[var(--ss-space-3)]"
              style={{
                borderColor: "var(--ss-reg-groundtruth-border)",
                borderRadius: "var(--ss-radius-sm)",
              }}
            >
              <dl className="grid grid-cols-2 gap-[var(--ss-space-4)] lg:grid-cols-4">
                <MetricValue label="health_state" value={asString(ev["health_state"])} register="GROUND_TRUTH" />
                <MetricValue
                  label="degradation_mechanism"
                  value={asString(ev["degradation_mechanism"])}
                  register="GROUND_TRUTH"
                />
                <MetricValue
                  label="degradation_stage"
                  value={asString(ev["degradation_stage"])}
                  register="GROUND_TRUTH"
                />
                <MetricValue label="y_true" value={asBoolean(ev["y_true"])} register="GROUND_TRUTH" />
              </dl>
              <p
                className="text-[var(--ss-text-muted)]"
                style={{ fontSize: "var(--ss-text-label-size)" }}
              >
                Shown so the detector&rsquo;s behaviour can be judged. The detector does not use
                these labels to reach a conclusion about the module.
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* ── module profile is not wired in ──────────────────────────── */}
      <Panel>
        <SectionHeader
          title="Component profile"
          subtitle="Datasheet-derived ratings, thermal specification and acceptance criteria."
          level={3}
        />
        <div className="p-[var(--ss-space-4)]">
          <EmptyState
            state="CAPABILITY_NOT_IMPLEMENTED"
            body="The M1 ModuleProfile and M2 TestProfile contracts exist as schemas, but they are not bound to an investigation and there is no ingestion or persistence for them. No datasheet ratings, thermal specification or acceptance limits can be shown."
            detail={
              profile.kind === "not-implemented"
                ? `${profile.endpoint} — ${profile.reference}`
                : undefined
            }
          />
        </div>
      </Panel>

      {/* ── investigations + next step ──────────────────────────────── */}
      <Panel>
        <SectionHeader
          title="Investigations for this module"
          level={3}
          actions={
            <Link
              href={`/investigations/new?module_id=${encodeURIComponent(moduleId)}`}
              className="ss-field-label border border-[var(--ss-accent)] px-[var(--ss-space-3)] py-[var(--ss-space-1)]"
              style={{
                borderRadius: "var(--ss-radius-sm)",
                backgroundColor: "var(--ss-accent-muted)",
              }}
            >
              Start Investigation
            </Link>
          }
        />
        <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          {d.investigations.length === 0 ? (
            <span className="text-[var(--ss-text-muted)]">
              No investigation has been recorded for this module yet.
            </span>
          ) : (
            <ul className="flex flex-col gap-[var(--ss-space-1)]">
              {d.investigations
                .slice()
                .reverse()
                .slice(0, 8)
                .map((i) => (
                  <li
                    key={i.investigation_id}
                    className="flex flex-wrap items-center gap-[var(--ss-space-3)]"
                  >
                    <Link
                      href={`/investigations/${i.investigation_id}`}
                      className="ss-mono text-[var(--ss-accent)] hover:text-[var(--ss-accent-hover)]"
                    >
                      {i.investigation_id}
                    </Link>
                    <StatusChip status={i.status} />
                    <span className="ss-mono text-[var(--ss-text-muted)]">{i.created_at}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </Panel>

      <NextAction
        href={`/components/${moduleId}/signals`}
        label="Inspect Signals"
        hint="the eight measured baseline signals over the stress history"
      />
    </>
  );
}
