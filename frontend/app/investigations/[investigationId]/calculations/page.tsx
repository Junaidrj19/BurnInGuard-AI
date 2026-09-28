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

export const metadata = { title: `Engineering Calculations — ${PRODUCT_NAME}` };

/**
 * Engineering Calculations — the fixed deterministic tools the
 * InvestigationAgent actually ran.
 *
 * Read straight from `GET /investigations/{id}/deterministic-results`. This page
 * renders tool name, version, input summary, output and provenance verbatim. It
 * performs no arithmetic of its own: the whole point of the deterministic layer
 * is that these numbers are reproducible from the backend, so recomputing them
 * in the browser would destroy that guarantee.
 *
 * A tool that did not run simply does not appear. No placeholder row is invented.
 */
export default async function CalculationsPage({
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

  const results: DeterministicResult[] =
    determResult.kind === "ok" ? determResult.data.results : [];

  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title="Engineering Calculations"
          subtitle="Fixed deterministic tools executed by the investigation. Values are rendered exactly as the backend produced them."
          actions={<RegisterBadge register="CALCULATION" />}
        />
        <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          {determResult.kind !== "ok" ? (
            <ErrorState result={determResult} />
          ) : results.length === 0 ? (
            <EmptyState
              state="ANALYSIS_NOT_PERFORMED"
              body="No deterministic tool result was recorded for this investigation."
              detail="backend/agents/investigation/tools/ — executed by the InvestigationAgent"
            />
          ) : (
            <div className="flex flex-wrap gap-[var(--ss-space-4)]">
              <MetricValue label="Tools run" value={results.length} register="DATA" />
              <MetricValue
                label="Distinct tools"
                value={new Set(results.map((r) => r.tool_name)).size}
                register="DATA"
              />
            </div>
          )}
        </div>
      </Panel>

      {results.map((r, i) => (
        <Panel key={`${r.tool_name}-${i}`}>
          <SectionHeader
            level={3}
            title={r.tool_name}
            subtitle={`tool_version ${r.tool_version}`}
            actions={<RegisterBadge register="CALCULATION" />}
          />
          <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
            <ResultBlock heading="Output" entries={r.output} />
            <ResultBlock heading="Input summary" entries={r.input_summary} />
            <ResultBlock heading="Provenance" entries={r.provenance} />
          </div>
        </Panel>
      ))}
    </>
  );
}

/**
 * Renders a flat key/value block from a backend dict.
 *
 * Nested structures are stringified rather than reshaped, so nothing is silently
 * dropped from the displayed output.
 */
function ResultBlock({
  heading,
  entries,
}: {
  heading: string;
  entries: Record<string, unknown>;
}) {
  const rows = Object.entries(entries ?? {}).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? "not recorded"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
  }));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-[var(--ss-space-1)]">
        <span className="ss-field-label">{heading}</span>
        <span className="text-[var(--ss-text-muted)] italic">empty</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--ss-space-2)]">
      <span className="ss-field-label">{heading}</span>
      <AccessibleDataTable
        caption={`${heading} values produced by this tool.`}
        rows={rows}
        rowKey={(r) => r.key}
        columns={[
          { key: "key", header: "field", render: (r) => <span className="ss-mono">{r.key}</span> },
          {
            key: "value",
            header: "value",
            render: (r) => <span className="ss-mono break-all">{r.value}</span>,
          },
        ]}
      />
    </div>
  );
}
