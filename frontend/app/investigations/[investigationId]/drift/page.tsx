import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessibleDataTable } from "@/components/AccessibleDataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MetricValue } from "@/components/MetricValue";
import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { getDeterministicResults, getInvestigation } from "@/lib/api/endpoints";
import { PRODUCT_NAME } from "@/lib/copy/product";
import type { DeterministicResult } from "@/lib/types/backend";

export const metadata = { title: `Drift Analysis — ${PRODUCT_NAME}` };

/**
 * Drift Analysis — parametric drift as actually measured by the deterministic
 * tools during this investigation.
 *
 * Sources, all real:
 *   calculate_drift              first, last, absolute_drift, percent_drift
 *   calculate_degradation_rate   degradation_rate, units
 *   calculate_slope              slope over the trajectory
 *   detect_change_point          where the behaviour changed
 *   compare_population           deviation against the healthy reference
 *
 * Component projection (forward terminal estimate from early-life data) is
 * implemented at the component level (`/components/{id}/prediction`) but is not
 * part of the investigation drift tool chain. This page shows measured drift
 * from deterministic tools only.
 */

/** Tools whose output is drift-related, in the order they are presented. */
const DRIFT_TOOLS = [
  "calculate_drift",
  "calculate_degradation_rate",
  "calculate_slope",
  "calculate_percent_change",
  "detect_change_point",
  "compare_population",
] as const;

export default async function DriftAnalysisPage({
  params,
}: {
  params: Promise<{ investigationId: string }>;
}) {
  const { investigationId } = await params;

  const [recordResult, determResult] = await Promise.all([
    getInvestigation(investigationId),
    getDeterministicResults(investigationId),
  ]);
  if (recordResult.kind !== "ok") notFound();

  const all: DeterministicResult[] =
    determResult.kind === "ok" ? determResult.data.results : [];
  const drift = all.filter((r) => (DRIFT_TOOLS as readonly string[]).includes(r.tool_name));

  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title="Drift Analysis"
          subtitle="Parametric drift measured by the deterministic tools for this investigation."
          actions={<RegisterBadge register="CALCULATION" />}
        />
        <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          {determResult.kind !== "ok" ? (
            <ErrorState result={determResult} />
          ) : drift.length === 0 ? (
            <EmptyState
              state="ANALYSIS_NOT_PERFORMED"
              body="No drift calculation was recorded for this investigation."
              detail="calculate_drift · calculate_degradation_rate · calculate_slope · detect_change_point · compare_population"
            />
          ) : (
            <div className="flex flex-wrap gap-[var(--ss-space-4)]">
              <MetricValue label="Drift tools run" value={drift.length} register="DATA" />
              <MetricValue
                label="Signals analysed"
                value={
                  new Set(
                    drift
                      .map((r) => r.input_summary?.["signal"])
                      .filter((v): v is string => typeof v === "string"),
                  ).size || null
                }
                register="DATA"
                note="from each tool's recorded input_summary"
              />
            </div>
          )}
        </div>
      </Panel>

      {drift.map((r, i) => {
        const signal = r.input_summary?.["signal"];
        return (
          <Panel key={`${r.tool_name}-${i}`}>
            <SectionHeader
              level={3}
              title={r.tool_name}
              subtitle={
                typeof signal === "string"
                  ? `signal ${signal} · tool_version ${r.tool_version}`
                  : `tool_version ${r.tool_version}`
              }
              actions={<RegisterBadge register="CALCULATION" />}
            />
            <div className="p-[var(--ss-space-4)]">
              <AccessibleDataTable
                caption={`Output of ${r.tool_name}, rendered exactly as the backend produced it.`}
                rows={Object.entries(r.output ?? {}).map(([key, value]) => ({
                  key,
                  value:
                    value === null || value === undefined
                      ? "not recorded"
                      : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value),
                }))}
                rowKey={(row) => row.key}
                columns={[
                  {
                    key: "key",
                    header: "field",
                    render: (row) => <span className="ss-mono">{row.key}</span>,
                  },
                  {
                    key: "value",
                    header: "value",
                    render: (row) => <span className="ss-mono break-all">{row.value}</span>,
                  },
                ]}
              />
            </div>
          </Panel>
        );
      })}

      {/* ── component projection lives on the component route ───────── */}
      <Panel>
        <SectionHeader
          level={3}
          title="Component projection"
          subtitle="Not part of this investigation view."
        />
        <div className="p-[var(--ss-space-4)]">
          <p
            className="text-[var(--ss-text-secondary)]"
            style={{ maxWidth: "var(--ss-measure-prose)" }}
          >
            Forward terminal estimation from early-life data is available on the
            component&apos;s Component Projection page. The drift tools above measure
            drift that has already been observed during this investigation; they do
            not extrapolate a future value.
          </p>
          <Link
            href={`/components/${encodeURIComponent(recordResult.data.module_id)}/prediction`}
            className="mt-[var(--ss-space-3)] inline-block ss-field-label text-[var(--ss-accent)] hover:underline"
          >
            Open Component Projection →
          </Link>
        </div>
      </Panel>
    </>
  );
}
