/**
 * Product-facing terminology for BurnInGuard AI.
 *
 * SCOPE: presentation labels only.
 *
 * The backend contracts are unchanged. `module_id`, `module_anomaly_status`,
 * `module_summary`, `test_id` and every other field name stay exactly as the API
 * returns them, and the TypeScript interfaces in `lib/types/` still mirror the
 * backend. This module only decides what an engineer READS.
 *
 * Two consequences that matter:
 *
 *  1. Raw identifiers and raw field names are still shown verbatim wherever an
 *     engineer needs to correlate the UI with an API payload or an artifact. A
 *     relabelled heading never hides the underlying field name.
 *  2. Nothing here changes an algorithm, a threshold or a contract, so this file
 *     cannot alter M1–M9 behaviour.
 */

/** Product term for the unit under test. Backend field: `module_id`. */
export const TERM_COMPONENT = "Component";
export const TERM_COMPONENT_PLURAL = "Components";
export const TERM_COMPONENT_ID = "Component ID";

/** Product term for the batch grouping. Backend field: `lot_id`. */
export const TERM_LOT = "Lot";
export const TERM_LOT_PLURAL = "Lots";

/** Product term for the screening outcome. Derived from `module_anomaly_status`. */
export const TERM_SCREENING_STATUS = "Screening status";

/** Product term for the monitoring activity M6/M7 perform. */
export const TERM_DRIFT_MONITORING = "Parametric drift monitoring";

/** Product term for what M9 performs. Never "fault diagnosis". */
export const TERM_INVESTIGATION = "Engineering failure investigation";

/** Product term for the M9 report's closing recommendation. */
export const TERM_RECOMMENDATION = "Engineering recommendation";

/** Product term for M9's hypothesis output. Never "failure diagnosis". */
export const TERM_MECHANISMS = "Candidate failure mechanisms";

/** Product term for the telemetry series. */
export const TERM_TELEMETRY = "Stress / reliability telemetry";

/** Product label for injected evaluation labels (never a system output). */
export const TERM_POST_HOC_EVALUATION = "Post-hoc evaluation value";

/** Shown on component projection surfaces. */
export const TERM_POST_HOC_EVALUATION_PREDICTION_NOTE =
  "Retrieved after prediction for evaluation only. This value is not provided to the model during prediction.";

/** Shown on detector-evaluation surfaces. */
export const TERM_POST_HOC_EVALUATION_DETECTOR_NOTE =
  "Injected synthetic labels. Retrieved for evaluation only — never used for training, never a system output.";

/**
 * Maps a backend field name to the product label used in headings.
 *
 * Used for documentation and for the adaptation map in the README. Pages import
 * the individual constants above rather than calling this, so a missing entry
 * can never silently produce an empty heading.
 */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  module_id: TERM_COMPONENT_ID,
  lot_id: TERM_LOT,
  module_anomaly_status: TERM_SCREENING_STATUS,
  test_id: "Stress Run ID",
  dataset_id: "Dataset",
  model_id: "Detector Model",
};
