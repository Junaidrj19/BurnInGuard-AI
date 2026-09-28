import { DemonstrationCase } from "@/components/DemonstrationCase";
import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { PRODUCT_NAME } from "@/lib/copy/product";
import type { Register } from "@/lib/registers";

export const metadata = { title: `Architecture — ${PRODUCT_NAME}` };

/**
 * Architecture — a STRUCTURAL view of the system.
 *
 * This page is deliberately static. It shows how the layers relate and which
 * module owns each stage; it does not animate, poll, or imply live execution.
 * Real execution is visible on an investigation's Pipeline Trace, where the
 * stages come from recorded provenance entries.
 *
 * The three-way separation is the point of the page:
 *
 *   deterministic / ML screening   reproducible, no language model involved
 *   agentic investigation          language model involved, validated, cited
 *   human engineering decision     the only place a disposition becomes a verdict
 */

interface Stage {
  readonly name: string;
  readonly detail: string;
  /** The implementing module, so a reader can go and read the code. */
  readonly owner: string;
  readonly register: Register;
}

interface Layer {
  readonly title: string;
  readonly character: string;
  readonly stages: readonly Stage[];
}

const LAYERS: readonly Layer[] = [
  {
    title: "Deterministic / ML screening",
    character:
      "Reproducible from frozen artifacts. No language model participates in any stage here, so every value can be recomputed from the same inputs.",
    stages: [
      {
        name: "Stress / reliability telemetry",
        detail:
          "Per-observation electrical and thermal signals: RDS_on, VTH, IGSS, IDSS, VDS_on, electrical_power, Tj, Tc.",
        owner: "M3 telemetry contract · M4 synthetic generator",
        register: "DATA",
      },
      {
        name: "Data validation",
        detail: "Structural, temporal and statistical checks before a dataset is used.",
        owner: "M5 validation engine",
        register: "CALCULATION",
      },
      {
        name: "Feature analysis",
        detail: "Versioned, deterministic, causal feature engineering over the observations.",
        owner: "M6 feature contract",
        register: "CALCULATION",
      },
      {
        name: "Anomaly detection",
        detail:
          "Isolation Forest over the observation feature matrix, plus an independent statistical baseline comparator.",
        owner: "M7 anomaly detection",
        register: "CALCULATION",
      },
      {
        name: "Detector evaluation",
        detail:
          "Offline evaluation against injected synthetic post-hoc evaluation labels. Evaluation-only; never used for training.",
        owner: "M8 evaluation layer",
        register: "GROUND_TRUTH",
      },
      {
        name: "Screening disposition",
        detail:
          "PASS / MONITOR / FLAG derived in the presentation layer from module_anomaly_status. EARLY REJECT requires a recorded acceptance-limit violation.",
        owner: "Presentation layer — lib/domain/disposition.ts",
        register: "CALCULATION",
      },
    ],
  },
  {
    title: "Agentic engineering investigation",
    character:
      "A language model participates here, so every stage is bounded: tools are fixed, evidence must resolve to a real document, and two validation gates run before anything reaches an engineer.",
    stages: [
      {
        name: "Investigation Agent",
        detail:
          "Loads the frozen trajectory and runs the fixed deterministic engineering tools. No language model output is involved in these numbers.",
        owner: "M9 investigation_agent + tools/",
        register: "CALCULATION",
      },
      {
        name: "Evidence Agent",
        detail:
          "Retrieves passages from the engineering knowledge base by vector search. Every record keeps its document, section and citation.",
        owner: "M9 evidence_agent · Chroma retrieval",
        register: "RETRIEVED_EVIDENCE",
      },
      {
        name: "Hypothesis Agent",
        detail:
          "Proposes competing candidate failure mechanisms, each citing supporting and contradictory evidence ids.",
        owner: "M9 hypothesis_agent",
        register: "LLM_REASONING",
      },
      {
        name: "Hypothesis validation",
        detail:
          "Rejects a hypothesis that cites an unknown evidence id, carries an out-of-range confidence, or asserts a status it has no evidence for.",
        owner: "M9 orchestrator gate",
        register: "VALIDATION",
      },
      {
        name: "Report Agent",
        detail:
          "Assembles the engineering report from findings, each tagged with its epistemic classification.",
        owner: "M9 report_agent",
        register: "LLM_REASONING",
      },
      {
        name: "Report validation",
        detail:
          "Rejects a missing required section, a citation to an unknown evidence id, a candidate mechanism asserted as CONFIRMED, or a narrative claiming unwarranted certainty.",
        owner: "M9 orchestrator gate",
        register: "VALIDATION",
      },
    ],
  },
  {
    title: "Human engineering decision",
    character:
      "The system stops here. It produces evidence and candidate mechanisms; it does not certify, reject or release a component.",
    stages: [
      {
        name: "Engineering review",
        detail:
          "An engineer reads the report, the evidence and the provenance, and makes the disposition decision. No verdict field exists in the backend, so none is stored.",
        owner: "Not automated by design",
        register: "HUMAN_DECISION",
      },
    ],
  },
];

export default function ArchitecturePage() {
  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title="Architecture"
          subtitle="How screening, investigation and the engineering decision relate. This is a structural view — it does not show live execution."
        />
        <div className="p-[var(--ss-space-4)]">
          <p
            className="text-[var(--ss-text-secondary)]"
            style={{ maxWidth: "var(--ss-measure-prose)" }}
          >
            The boundary that matters is between the first layer and the second. Layer
            one is reproducible arithmetic over frozen artifacts. Layer two involves a
            language model and is therefore constrained by fixed tools, resolvable
            citations and two validation gates. Layer three is a person.
          </p>
        </div>
      </Panel>

      {LAYERS.map((layer, layerIndex) => (
        <Panel key={layer.title}>
          <SectionHeader
            level={2}
            title={`${layerIndex + 1}. ${layer.title}`}
            subtitle={layer.character}
          />
          <div className="flex flex-col">
            {layer.stages.map((stage, stageIndex) => (
              <div
                key={stage.name}
                className="flex gap-[var(--ss-space-3)] border-t border-[var(--ss-border-subtle)] px-[var(--ss-space-4)] py-[var(--ss-space-3)]"
              >
                <span
                  className="ss-mono shrink-0 text-[var(--ss-text-muted)]"
                  style={{ fontSize: "var(--ss-text-label-size)" }}
                  aria-hidden="true"
                >
                  {String(stageIndex + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[var(--ss-space-1)]">
                  <div className="flex flex-wrap items-center justify-between gap-[var(--ss-space-2)]">
                    <span className="font-medium text-[var(--ss-text-primary)]">
                      {stage.name}
                    </span>
                    <RegisterBadge register={stage.register} />
                  </div>
                  <p
                    className="text-[var(--ss-text-secondary)]"
                    style={{ maxWidth: "var(--ss-measure-prose)" }}
                  >
                    {stage.detail}
                  </p>
                  <span
                    className="ss-mono text-[var(--ss-text-muted)]"
                    style={{ fontSize: "var(--ss-text-label-size)" }}
                  >
                    {stage.owner}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      <DemonstrationCase />
    </>
  );
}
