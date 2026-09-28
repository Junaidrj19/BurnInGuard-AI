import { Panel, SectionHeader } from "@/components/Panel";

/**
 * StaticVsDynamic (SIH Part 3).
 *
 * Makes concrete the distinction the SIH problem statement draws:
 *
 *   CONVENTIONAL SCREENING      — absolute specification limit → PASS / FAIL
 *   BURNINGUARD ANOMALY DETECTION — population-relative + temporal behaviour
 *                                  → Normal / Sporadic / Persistent anomaly
 *                                  → engineering screening status
 *
 * This is presentational framing only. It introduces no threshold and no metric; the
 * underlying values are rendered from the real module anomaly status elsewhere. It is
 * included here so the product never implies that BurnInGuard replaces the actual
 * acceptance criteria — it is an additional dynamic screening layer.
 */
export function StaticVsDynamic() {
  return (
    <Panel>
      <SectionHeader
        title="Screening approaches"
        subtitle="Static limits catch obvious failures. Dynamic anomaly detection is population-relative and temporal, and does not replace the acceptance criteria."
      />

      <div className="grid grid-cols-1 gap-[var(--ss-space-4)] p-[var(--ss-space-4)] lg:grid-cols-2">
        <div className="flex flex-col gap-[var(--ss-space-2)] border border-[var(--ss-border-subtle)] p-[var(--ss-space-4)]">
          <span className="ss-field-label text-[var(--ss-state-pass)]">
            Conventional screening
          </span>
          <p className="text-[var(--ss-text-secondary)]">
            Absolute specification limit
          </p>
          <div className="flex items-center gap-[var(--ss-space-2)] ss-mono text-[var(--ss-text-muted)]">
            <span>
              PASS <span aria-hidden="true">/</span> FAIL
            </span>
          </div>
          <p
            className="text-[var(--ss-text-muted)]"
            style={{ fontSize: "var(--ss-text-label-size)" }}
          >
            Answers: did the component cross the datasheet specification limit?
          </p>
        </div>

        <div className="flex flex-col gap-[var(--ss-space-2)] border border-[var(--ss-border-strong)] p-[var(--ss-space-4)]">
          <span className="ss-field-label" style={{ color: "var(--ss-accent)" }}>
            BurnInGuard Anomaly Detection
          </span>
          <p className="text-[var(--ss-text-secondary)]">
            Population-relative + temporal behaviour
          </p>
          <div className="flex flex-col gap-[var(--ss-space-1)] ss-mono text-[var(--ss-text-secondary)]">
            <span>
              Normal <span aria-hidden="true">/</span> Sporadic <span aria-hidden="true">/</span> Persistent anomaly
            </span>
            <span aria-hidden="true">↓</span>
            <span>Engineering screening status</span>
          </div>
          <p
            className="text-[var(--ss-text-muted)]"
            style={{ fontSize: "var(--ss-text-label-size)" }}
          >
            Answers: how unusual is this component relative to the observed lot and
            its own time-series?
          </p>
        </div>
      </div>

      <p
        className="px-[var(--ss-space-4)] pb-[var(--ss-space-4)] text-[var(--ss-text-muted)]"
        style={{ fontSize: "var(--ss-text-label-size)", maxWidth: "var(--ss-measure-prose)" }}
      >
        BurnInGuard does not replace the actual acceptance criteria. It is an
        additional dynamic screening layer over the observed population.
      </p>
    </Panel>
  );
}
