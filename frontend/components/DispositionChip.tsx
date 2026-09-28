import { StatusChip } from "@/components/StatusChip";
import { DISPOSITION_MEANING, type DispositionDerivation } from "@/lib/domain/disposition";

/**
 * DispositionChip — a BurnInGuard screening disposition WITH its derivation.
 *
 * The derivation is rendered, not implied. An evaluator must be able to see at a
 * glance that PASS/MONITOR/FLAG is a product label computed from an existing
 * backend field, and not a prediction the backend made.
 *
 * The chip therefore always shows:
 *   - the disposition label
 *   - the backend field it came from, and that field's verbatim value
 *   - the derivation rule, on request
 *
 * An unrecognised source value renders as NOT DERIVED rather than defaulting to
 * PASS, so a future `module_anomaly_status` member cannot be silently presented
 * as a clean component.
 */
export function DispositionChip({
  derivation,
  showRule = false,
  className = "",
}: {
  derivation: DispositionDerivation;
  /** Render the full derivation rule beneath the chip. */
  showRule?: boolean;
  className?: string;
}) {
  const { disposition, sourceField, sourceValue, rule, unknown } = derivation;

  return (
    <div className={`flex flex-col gap-[var(--ss-space-1)] ${className}`}>
      <div className="flex flex-wrap items-center gap-[var(--ss-space-2)]">
        {disposition ? (
          <StatusChip status={disposition} />
        ) : (
          <span
            className="ss-field-label inline-flex shrink-0 items-center border border-solid border-[var(--ss-border-subtle)] px-[var(--ss-space-1)] text-[var(--ss-text-muted)]"
            style={{ borderRadius: "var(--ss-radius-sm)" }}
            data-status="not-derived"
          >
            NOT DERIVED
          </span>
        )}
        <span
          className="text-[var(--ss-text-muted)]"
          style={{ fontSize: "var(--ss-text-label-size)" }}
        >
          derived from{" "}
          <span className="ss-mono text-[var(--ss-text-secondary)]">{sourceField}</span>
          {" = "}
          <span className="ss-mono text-[var(--ss-text-secondary)]">
            {sourceValue ?? "not recorded"}
          </span>
        </span>
      </div>

      {disposition && (
        <p
          className="text-[var(--ss-text-secondary)]"
          style={{
            fontSize: "var(--ss-text-label-size)",
            maxWidth: "var(--ss-measure-prose)",
          }}
        >
          {DISPOSITION_MEANING[disposition]}
        </p>
      )}

      {unknown && (
        <p
          className="text-[var(--ss-text-muted)]"
          style={{ fontSize: "var(--ss-text-label-size)" }}
        >
          The backend reported a screening status this build does not recognise. No
          disposition is asserted.
        </p>
      )}

      {showRule && (
        <p
          className="text-[var(--ss-text-muted)]"
          style={{
            fontSize: "var(--ss-text-label-size)",
            maxWidth: "var(--ss-measure-prose)",
          }}
        >
          {rule}
        </p>
      )}
    </div>
  );
}
