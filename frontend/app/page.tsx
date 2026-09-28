import Link from "next/link";
import { AccessibleDataTable } from "@/components/AccessibleDataTable";
import { DemonstrationCase } from "@/components/DemonstrationCase";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MetricValue } from "@/components/MetricValue";
import { MissionFlow } from "@/components/MissionFlow";
import { Panel, SectionHeader, SplitPanel } from "@/components/Panel";
import { StatusChip } from "@/components/StatusChip";
import {
  getCorpus,
  getModulePopulation,
  getReadiness,
  listInvestigations,
  listModels,
} from "@/lib/api/endpoints";
import {
  KNOWLEDGE_BASE_NAME,
  PRODUCT_NAME,
  PRODUCT_ORIENTATION,
} from "@/lib/copy/product";
import { ANOMALY_QUALIFICATION, SYNTHETIC_NOTE } from "@/lib/copy/states";
import { inferenceChipStatus } from "@/lib/copy/status";
import { DISPOSITION_LABEL, dispositionCounts } from "@/lib/domain/disposition";

export const metadata = { title: `Screening Overview — ${PRODUCT_NAME}` };

/** The component used throughout the demonstration case. */
const DEMO_COMPONENT = "syn-mod-0042";

/**
 * Screening Overview — the engineering workstation entry point (UX.md §5).
 *
 * Answers, in the first viewport: what am I looking at, what data exists, what
 * has already been screened, where the investigation happens, what to inspect
 * next.
 *
 * Every number is read from the backend. When a capability is unavailable the
 * panel says which one and why — it never substitutes a plausible figure. The
 * screening dispositions are derived from `module_anomaly_status` and the source
 * value is rendered beside each one.
 */
export default async function ScreeningOverviewPage() {
  const [readinessResult, populationResult, modelsResult, investigationsResult, corpusResult] =
    await Promise.all([
      getReadiness(),
      getModulePopulation(),
      listModels(),
      listInvestigations(),
      getCorpus(),
    ]);

  const readiness = readinessResult.kind === "ok" ? readinessResult.data : null;
  const population = populationResult.kind === "ok" ? populationResult.data : null;
  const models = modelsResult.kind === "ok" ? modelsResult.data : [];
  const investigations = investigationsResult.kind === "ok" ? investigationsResult.data : [];
  const corpus = corpusResult.kind === "ok" ? corpusResult.data : null;

  const model = models[0] ?? null;
  const absent = readiness?.artifacts.filter((a) => a.status !== "PRESENT") ?? [];

  const statusCounts = investigations.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
  const demoInvestigations = investigations.filter((i) => i.module_id === DEMO_COMPONENT);

  const { counts: dispositions, unmapped } = dispositionCounts(population?.by_anomaly_status);

  return (
    <>
      {/* ── orientation: what is this ────────────────────────────────── */}
      <Panel>
        <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
          <h1
            className="font-medium text-[var(--ss-text-primary)]"
            style={{ fontSize: "var(--ss-text-title-size)", lineHeight: "var(--ss-leading-tight)" }}
          >
            Screening Overview
          </h1>
          <p
            className="text-[var(--ss-text-primary)]"
            style={{
              fontSize: "var(--ss-text-section-size)",
              maxWidth: "var(--ss-measure-prose)",
            }}
          >
            {PRODUCT_ORIENTATION}
          </p>
          <div className="flex flex-wrap items-center gap-[var(--ss-space-4)]">
            <span className="ss-field-label">
              API <StatusChip status={readiness ? "READY" : "NOT_CONFIGURED"} />
            </span>
            {readiness && (
              <span className="ss-field-label">
                Inference <StatusChip status={inferenceChipStatus(readiness.llm)} />
              </span>
            )}
            {model && (
              <span className="ss-field-label">
                Detector{" "}
                <span className="ss-mono normal-case text-[var(--ss-text-secondary)]">
                  {model.model_id}
                </span>
              </span>
            )}
            <span className="ss-field-label">
              Data origin{" "}
              <span className="ss-mono normal-case text-[var(--ss-text-secondary)]">SYNTHETIC</span>
            </span>
          </div>
          {readinessResult.kind !== "ok" && <ErrorState result={readinessResult} />}
        </div>
      </Panel>

      {/* ── platform vs demonstration case ──────────────────────────── */}
      <DemonstrationCase />

      {/* ── the workflow ─────────────────────────────────────────────── */}
      <Panel>
        <SectionHeader
          title="Detection to investigation chain"
          subtitle="Each stage is a real computational stage. Register treatment shows whether a stage produces data, a calculation, retrieved evidence, model reasoning or a validation outcome."
        />
        <div className="p-[var(--ss-space-4)]">
          <MissionFlow />
        </div>
      </Panel>

      {/* ── primary action ──────────────────────────────────────────── */}
      <Panel>
        <SectionHeader
          title="Begin"
          subtitle="An investigation is always scoped to one component. Pick a component, review the configuration, then run."
        />
        <div className="flex flex-wrap items-center gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          <Link
            href="/components"
            className="ss-field-label border border-[var(--ss-accent)] px-[var(--ss-space-4)] py-[var(--ss-space-2)] text-[var(--ss-text-primary)]"
            style={{
              borderRadius: "var(--ss-radius-sm)",
              backgroundColor: "var(--ss-accent-muted)",
            }}
          >
            Select a component
          </Link>
          <Link
            href={`/components/${DEMO_COMPONENT}`}
            className="ss-field-label border border-[var(--ss-border-strong)] px-[var(--ss-space-3)] py-[var(--ss-space-2)] hover:border-[var(--ss-accent)]"
            style={{ borderRadius: "var(--ss-radius-sm)" }}
          >
            Open demonstration component {DEMO_COMPONENT}
          </Link>
          {demoInvestigations.length > 0 && (
            <Link
              href={`/investigations/${demoInvestigations[demoInvestigations.length - 1]!.investigation_id}`}
              className="ss-field-label border border-[var(--ss-border-strong)] px-[var(--ss-space-3)] py-[var(--ss-space-2)] hover:border-[var(--ss-accent)]"
              style={{ borderRadius: "var(--ss-radius-sm)" }}
            >
              Open latest demonstration investigation
            </Link>
          )}
        </div>
      </Panel>

      <SplitPanel
        ratio="balanced"
        left={
          /* ── population + derived dispositions ──────────────────── */
          <Panel>
            <SectionHeader
              title="Component population"
              subtitle={ANOMALY_QUALIFICATION}
              level={3}
              actions={
                <Link
                  href="/components"
                  className="ss-field-label border border-[var(--ss-border-strong)] px-[var(--ss-space-2)] py-[var(--ss-space-1)] hover:border-[var(--ss-accent)]"
                  style={{ borderRadius: "var(--ss-radius-sm)" }}
                >
                  Explore
                </Link>
              }
            />
            <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
              {!population ? (
                <>
                  <EmptyState
                    state="CAPABILITY_NOT_IMPLEMENTED"
                    body="Component population could not be read. The module-summary artifact is required."
                  />
                  <ErrorState result={populationResult} />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-[var(--ss-space-4)]">
                    <MetricValue
                      label="Components screened"
                      value={population.n_modules}
                      register="DATA"
                      note={SYNTHETIC_NOTE}
                    />
                    <MetricValue
                      label="Lots"
                      value={Object.keys(population.by_lot).length}
                      register="DATA"
                    />
                  </div>

                  <AccessibleDataTable
                    caption="Screening disposition with the backend field it was derived from, and a filtered link into the component explorer."
                    rows={dispositions}
                    rowKey={(r) => r.disposition}
                    columns={[
                      {
                        key: "disposition",
                        header: "screening disposition",
                        render: (r) => <StatusChip status={r.disposition} />,
                      },
                      {
                        key: "sourceValue",
                        header: "module_anomaly_status",
                        render: (r) => (
                          <Link
                            href={`/components?anomaly_status=${r.sourceValue}`}
                            className="ss-mono text-[var(--ss-accent)]"
                          >
                            {r.sourceValue}
                          </Link>
                        ),
                      },
                      { key: "count", header: "components", render: (r) => r.count, align: "right" },
                    ]}
                  />

                  <p
                    className="text-[var(--ss-text-muted)]"
                    style={{
                      fontSize: "var(--ss-text-label-size)",
                      maxWidth: "var(--ss-measure-prose)",
                    }}
                  >
                    Dispositions are derived in the presentation layer from
                    <span className="ss-mono"> module_anomaly_status</span>. They are not backend
                    fields and not predictions. EARLY REJECT is omitted here because it requires
                    per-investigation acceptance-limit results, which a population count does not
                    contain — reporting it as zero would assert something this data cannot support.
                  </p>

                  {unmapped.length > 0 && (
                    <EmptyState
                      state="CAPABILITY_NOT_IMPLEMENTED"
                      body="The backend reported a screening status this build does not recognise, so it was not mapped to a disposition."
                      detail={unmapped.map((u) => `${u.sourceValue} — ${u.count}`).join(" · ")}
                    />
                  )}
                </>
              )}
            </div>
          </Panel>
        }
        right={
          /* ── investigation coverage ─────────────────────────────── */
          <Panel>
            <SectionHeader
              title="Investigation coverage"
              subtitle="Stored investigations on this host."
              level={3}
              actions={
                <Link
                  href="/history"
                  className="ss-field-label border border-[var(--ss-border-strong)] px-[var(--ss-space-2)] py-[var(--ss-space-1)] hover:border-[var(--ss-accent)]"
                  style={{ borderRadius: "var(--ss-radius-sm)" }}
                >
                  Review
                </Link>
              }
            />
            <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
              {investigationsResult.kind !== "ok" ? (
                <ErrorState result={investigationsResult} />
              ) : investigations.length === 0 ? (
                <EmptyState
                  state="NO_DATA"
                  body="No investigations have been recorded in this environment."
                  detail="ml/datasets/investigations/ — scripts/investigate.py"
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-[var(--ss-space-4)]">
                    <MetricValue
                      label="Investigations"
                      value={investigations.length}
                      register="DATA"
                    />
                    <MetricValue
                      label="Components investigated"
                      value={new Set(investigations.map((i) => i.module_id)).size}
                      register="DATA"
                    />
                  </div>
                  <div className="flex flex-wrap gap-[var(--ss-space-2)]">
                    {Object.entries(statusCounts)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([status, count]) => (
                        <StatusChip key={status} status={status} suffix={String(count)} />
                      ))}
                  </div>
                  <div className="flex flex-col gap-[var(--ss-space-1)]">
                    <span className="ss-field-label">Most recent</span>
                    {investigations
                      .slice(-4)
                      .reverse()
                      .map((i) => (
                        <div
                          key={i.investigation_id}
                          className="flex flex-wrap items-center justify-between gap-[var(--ss-space-2)]"
                        >
                          <Link
                            href={`/investigations/${i.investigation_id}`}
                            className="ss-mono break-all text-[var(--ss-accent)] hover:text-[var(--ss-accent-hover)]"
                          >
                            {i.investigation_id}
                          </Link>
                          <StatusChip status={i.status} />
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </Panel>
        }
      />

      {/* ── readiness summary ───────────────────────────────────────── */}
      <Panel>
        <SectionHeader
          title="Pipeline status"
          subtitle="What this environment can and cannot show."
          level={3}
          actions={
            <Link
              href="/system/readiness"
              className="ss-field-label border border-[var(--ss-border-strong)] px-[var(--ss-space-2)] py-[var(--ss-space-1)] hover:border-[var(--ss-accent)]"
              style={{ borderRadius: "var(--ss-radius-sm)" }}
            >
              Inspect
            </Link>
          }
        />
        <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          {!readiness ? (
            <ErrorState result={readinessResult} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-[var(--ss-space-4)]">
                <MetricValue
                  label="Artifacts present"
                  value={`${readiness.artifacts.length - absent.length}/${readiness.artifacts.length}`}
                  register="DATA"
                />
                <MetricValue
                  label={KNOWLEDGE_BASE_NAME}
                  value={
                    corpus?.collection.chunk_count !== null &&
                    corpus?.collection.chunk_count !== undefined
                      ? `${corpus.collection.chunk_count} chunks`
                      : null
                  }
                  register="RETRIEVED_EVIDENCE"
                  note={
                    corpus
                      ? `${corpus.counts_by_verification_status["VERIFIED"] ?? 0} VERIFIED of ${corpus.n_documents} documents`
                      : undefined
                  }
                />
                <MetricValue
                  label="LLM provider"
                  value={readiness.llm.provider}
                  register="LLM_REASONING"
                  note={readiness.llm.endpoint_host ?? undefined}
                />
                <MetricValue
                  label="LLM model"
                  value={readiness.llm.model}
                  register="LLM_REASONING"
                  note={
                    inferenceChipStatus(readiness.llm) === "REAL_INFERENCE"
                      ? "real inference — the hypothesis agent will call this model"
                      : inferenceChipStatus(readiness.llm) === "NOT_CONFIGURED"
                        ? "provider is not configured — production will not mock a hypothesis"
                        : "hypothesis agent will be mocked"
                  }
                />
              </div>
              {absent.length > 0 && (
                <EmptyState
                  state="NO_DATA"
                  body={`${absent.length} artifact${absent.length === 1 ? " is" : "s are"} absent, so some surfaces cannot be inspected.`}
                  detail={absent.map((a) => `${a.artifact} — ${a.path}`).join(" · ")}
                />
              )}
            </>
          )}
        </div>
      </Panel>
    </>
  );
}
