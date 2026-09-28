/**
 * MissionFlow — the investigation chain as a compact process map (UX.md §5).
 *
 * "This is an orientation device, not decorative animation." Each stage is a
 * real pipeline stage that the backend actually performs.
 *
 * Availability on this map must not be confused with the nav legend:
 *
 *   (no marker)  implemented; inspect from Screening or a component
 *   INV          implemented; inspect on an open investigation
 *   N/I          not used here — every stage in this chain exists
 *
 * Linking an investigation stage from the overview would be a dead end without
 * an investigation id, so those rows stay unlinked and are marked INV.
 */

import Link from "next/link";
import type { Register } from "@/lib/registers";
import { registerDefinition } from "@/lib/registers";

interface FlowStage {
  readonly label: string;
  readonly register: Register;
  readonly detail: string;
  /** Screening stages can open the component explorer. Investigation stages cannot. */
  readonly href?: string;
  /** True when the stage is implemented but only inspectable on an open investigation. */
  readonly needsInvestigation: boolean;
}

const STAGES: readonly FlowStage[] = [
  {
    label: "DATA",
    register: "DATA",
    detail: "8 baseline signals per observation (M6 v1)",
    href: "/components",
    needsInvestigation: false,
  },
  {
    label: "ANOMALY DETECTION",
    register: "DATA",
    detail: "Isolation Forest anomaly score and flag (M7)",
    href: "/components",
    needsInvestigation: false,
  },
  {
    label: "DETECTOR EVALUATION",
    register: "CALCULATION",
    detail: "Detector behaviour against a frozen population (M8)",
    href: "/components",
    needsInvestigation: false,
  },
  {
    label: "DETERMINISTIC ANALYSIS",
    register: "CALCULATION",
    detail: "Fixed engineering tools — no model involved",
    needsInvestigation: true,
  },
  {
    label: "EVIDENCE RETRIEVAL",
    register: "RETRIEVED_EVIDENCE",
    detail: "Passages from verified engineering documents",
    needsInvestigation: true,
  },
  {
    label: "LLM HYPOTHESES",
    register: "LLM_REASONING",
    detail: "Competing candidate mechanisms, cited to evidence",
    needsInvestigation: true,
  },
  {
    label: "VALIDATION",
    register: "VALIDATION",
    detail: "Hypothesis and report gates",
    needsInvestigation: true,
  },
  {
    label: "ENGINEERING REPORT",
    register: "DATA",
    detail: "15 sections, every finding classified",
    needsInvestigation: true,
  },
];

export function MissionFlow() {
  return (
    <div className="flex flex-col gap-[var(--ss-space-3)]">
      <ol className="flex flex-col gap-[var(--ss-space-1)]" aria-label="Investigation chain">
        {STAGES.map((stage, index) => {
          const def = registerDefinition(stage.register);
          const body = (
            <div
              className={`flex items-baseline gap-[var(--ss-space-3)] px-[var(--ss-space-3)] py-[var(--ss-space-2)] ${def.surface}`}
              style={{ borderRadius: "var(--ss-radius-sm)" }}
              data-register={stage.register}
            >
              <span className="ss-mono shrink-0 text-[var(--ss-text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="ss-field-label shrink-0 w-[172px] text-[var(--ss-text-primary)]">
                {stage.label}
              </span>
              <span className="min-w-0 flex-1 text-[var(--ss-text-secondary)]">{stage.detail}</span>
              {stage.needsInvestigation ? (
                <span
                  className="ss-field-label shrink-0 text-[var(--ss-text-muted)]"
                  title="Implemented. Open an investigation to inspect this stage."
                >
                  INV
                </span>
              ) : (
                <span className="ss-sr-only">Implemented</span>
              )}
            </div>
          );

          return (
            <li key={stage.label}>
              {stage.href ? (
                <Link href={stage.href} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
      <p
        className="text-[var(--ss-text-muted)]"
        style={{ fontSize: "var(--ss-text-label-size)", maxWidth: "var(--ss-measure-prose)" }}
      >
        Every stage in this chain is implemented. Screening stages open the
        component explorer. <span className="ss-mono">INV</span> stages are
        inspectable on an open investigation.{" "}
        <span className="ss-mono">N/I</span> is reserved for capabilities that
        do not exist in this backend.
      </p>
    </div>
  );
}
