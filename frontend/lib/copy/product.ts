/**
 * Product-facing vocabulary for BurnInGuard AI.
 *
 * This file is the single source of product naming and positioning copy. It is
 * deliberately separate from `lib/copy/states.ts` (analytical state copy) and
 * `lib/copy/status.ts` (backend status vocabulary), because those two describe
 * backend truth while this file describes the product.
 *
 * TRUTHFULNESS RULES for anything added here:
 *
 *  - BurnInGuard AI is the product. The SIH power module is the current
 *    demonstration case, and that distinction must stay explicit in the UI.
 *  - The demonstration dataset is a POWER-CYCLING reliability dataset
 *    (`dataset_id: syn-sic-pc-dev-001`, see
 *    docs/data-generation/synthetic-dataset-specification.md). It must never be
 *    described as burn-in data, because no burn-in/HTOL telemetry exists here.
 *  - No engineering number belongs in this file. Every measured or calculated
 *    value is rendered from a backend payload by the page that reads it.
 */

export const PRODUCT_NAME = "BurnInGuard AI";

/** Compact wordmark for the navigation rail. */
export const PRODUCT_WORDMARK = "BURNINGUARD AI";

export const PRODUCT_SUBTITLE =
  "Burn-In Screening & Engineering Investigation";

/** Subtitle for the product shell and navigation rail. */
export const PRODUCT_SUBTITLE_SHORT = "Burn-In Screening & Engineering Investigation";

/**
 * The one orientation sentence for the Screening Overview. It names the real
 * chain the backend actually executes, in order.
 */
export const PRODUCT_ORIENTATION =
  "BurnInGuard AI traces abnormal electrical behaviour from measured signals through anomaly detection, engineering calculations, evidence retrieval, competing hypotheses, validation, and a traceable engineering report.";

/**
 * Platform-versus-demonstration positioning. Rendered by
 * `components/DemonstrationCase.tsx`.
 *
 * The wording is deliberately restrained: it establishes that the architecture
 * is component-agnostic without claiming validation across component families
 * that have never been tested here.
 */
export const DEMONSTRATION_CASE = {
  label: "Demonstration Case",
  subject: "SIH Power Module",
  body:
    "BurnInGuard AI is designed as a component-agnostic burn-in screening and engineering investigation platform. The SIH power module is used as the concrete demonstration case because the problem statement does not prescribe a single component family or provide a component-specific investigation corpus.",
  /**
   * Stated separately from `body` because it is a fact about the data rather
   * than positioning, and it must not be softened.
   */
  datasetNote:
    "The current demonstration data is a synthetic power-cycling reliability dataset, not a burn-in screen. The screening and investigation pipeline is demonstrated using this reliability case; no claim is made that the current implementation has been validated across other component families.",
  scopeNote: "",
} as const;

/**
 * Run terminology. The backend has no `test_type` field and no run resource:
 * `test_id` is a column on the module summary. So the product labels the entity
 * and the real identifier is always displayed next to it.
 */
export const RUN_LABEL = "Stress Run — Power Cycling";
export const RUN_LABEL_QUALIFIED = "Stress Run (power cycling)";
export const RUN_LABEL_NOTE =
  "Stress type is a property of the demonstration dataset specification, not a telemetry field.";

/**
 * Knowledge base naming.
 *
 * Deliberately NOT "Burn-In Knowledge Base". The corpus coverage report
 * (knowledge_base/reports/corpus-coverage.md) records that HTOL is covered by a
 * single document incidentally and that no corpus document reports an HTOL test
 * programme of its own. The dedicated screening standards (JESD22-A108,
 * AEC-Q101) are marked NEEDS_MANUAL_ACCESS and are not present on disk, so they
 * are never presented as included.
 */
export const KNOWLEDGE_BASE_NAME = "Engineering Reliability Knowledge Base";

export const KNOWLEDGE_BASE_COVERAGE =
  "Coverage includes power cycling, gate-oxide degradation, die-attach degradation, and bond-wire degradation. Dedicated burn-in/HTOL standards are not represented in the current corpus.";

/**
 * The screening-to-investigation chain, used by the Screening Overview and the
 * Architecture page. Each entry names a stage that the backend genuinely
 * performs; nothing here is aspirational.
 */
export const PRODUCT_CHAIN = [
  "Stress / reliability telemetry",
  "Feature analysis",
  "Anomaly detection",
  "Screening disposition",
  "Engineering investigation",
  "Evidence retrieval",
  "Candidate failure mechanisms",
  "Validation",
  "Engineering report",
  "Human engineering review",
] as const;
