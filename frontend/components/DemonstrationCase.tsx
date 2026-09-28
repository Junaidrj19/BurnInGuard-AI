import { Panel } from "@/components/Panel";
import { DEMONSTRATION_CASE } from "@/lib/copy/product";

/**
 * DemonstrationCase — separates the BurnInGuard AI platform from the SIH
 * power-module case it is currently demonstrated with.
 *
 * Deliberately restrained. It exists to establish technical honesty, not to
 * advertise: an evaluator should be able to tell immediately that the
 * architecture is component-agnostic by design, that this particular case is a
 * demonstration, and that the demonstration data is power cycling rather than a
 * burn-in screen.
 *
 * `variant="inline"` is the compact form for pages that already have a heading.
 */
export function DemonstrationCase({
  variant = "panel",
  showDatasetNote = true,
}: {
  variant?: "panel" | "inline";
  showDatasetNote?: boolean;
}) {
  const body = (
    <div className="flex flex-col gap-[var(--ss-space-2)]">
      <div className="flex flex-wrap items-baseline gap-[var(--ss-space-2)]">
        <span className="ss-field-label">{DEMONSTRATION_CASE.label}</span>
        <span className="ss-mono font-medium text-[var(--ss-text-primary)]">
          {DEMONSTRATION_CASE.subject}
        </span>
      </div>
      <p
        className="text-[var(--ss-text-secondary)]"
        style={{ maxWidth: "var(--ss-measure-prose)" }}
      >
        {DEMONSTRATION_CASE.body}
      </p>
      {showDatasetNote && (
        <p
          className="text-[var(--ss-text-muted)]"
          style={{
            fontSize: "var(--ss-text-label-size)",
            maxWidth: "var(--ss-measure-prose)",
          }}
        >
          {DEMONSTRATION_CASE.datasetNote}
          {DEMONSTRATION_CASE.scopeNote ? ` ${DEMONSTRATION_CASE.scopeNote}` : ""}
        </p>
      )}
    </div>
  );

  if (variant === "inline") return body;

  return (
    <Panel as="aside">
      <div className="p-[var(--ss-space-4)]">{body}</div>
    </Panel>
  );
}
