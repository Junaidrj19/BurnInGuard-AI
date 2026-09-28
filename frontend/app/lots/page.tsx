import Link from "next/link";
import { AccessibleDataTable } from "@/components/AccessibleDataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MetricValue } from "@/components/MetricValue";
import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { StatusChip } from "@/components/StatusChip";
import { getModulePopulation, listModels } from "@/lib/api/endpoints";
import { PRODUCT_NAME } from "@/lib/copy/product";
import { ANOMALY_QUALIFICATION } from "@/lib/copy/states";
import { dispositionFromAnomalyStatus } from "@/lib/domain/disposition";

export const metadata = { title: `Lots — ${PRODUCT_NAME}` };

/**
 * Lots — batch-level screening view.
 *
 * Built entirely from `GET /modules/population`, which returns real `by_lot` and
 * `by_lot_and_status` counts computed from `module-summary.parquet`. Each lot row
 * links into the component explorer filtered by that lot, so every number is
 * traceable to the rows behind it.
 *
 * No lot-level metric is synthesised. In particular there is no lot yield, no lot
 * pass rate and no lot risk score, because none of those exist in the backend —
 * only counts by anomaly status do.
 */
export default async function LotsPage() {
  const [populationResult, modelsResult] = await Promise.all([
    getModulePopulation(),
    listModels(),
  ]);

  const population = populationResult.kind === "ok" ? populationResult.data : null;
  const models = modelsResult.kind === "ok" ? modelsResult.data : [];
  const model = models[0] ?? null;

  const lots = population
    ? Object.entries(population.by_lot)
        .map(([lotId, total]) => {
          const statuses = population.by_lot_and_status[lotId] ?? {};
          return {
            lotId,
            total,
            clean: statuses["clean"] ?? 0,
            sporadic: statuses["sporadic"] ?? 0,
            persistent: statuses["persistent"] ?? 0,
          };
        })
        .sort((a, b) => a.lotId.localeCompare(b.lotId))
    : [];

  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title="Lots"
          subtitle="Batch-level screening counts. Each lot links into the component explorer filtered by that lot."
          actions={<RegisterBadge register="DATA" />}
        />
        <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
          {!population ? (
            <>
              <EmptyState
                state="NO_DATA"
                body="Lot counts could not be read. The module-summary artifact is required."
                detail="ml/datasets/scores/{model_id}/module-summary.parquet — scripts/score_anomaly.py"
              />
              <ErrorState result={populationResult} />
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-[var(--ss-space-4)]">
                <MetricValue label="Lots" value={lots.length} register="DATA" />
                <MetricValue
                  label="Components screened"
                  value={population.n_modules}
                  register="DATA"
                />
                {model && (
                  <MetricValue label="Detector" value={model.model_id} register="DATA" />
                )}
              </div>
              <p className="text-[var(--ss-text-muted)]">{ANOMALY_QUALIFICATION}</p>
            </>
          )}
        </div>
      </Panel>

      {population && (
        <Panel>
          <SectionHeader
            level={3}
            title="Screening counts by lot"
            subtitle="Counts come from module_anomaly_status. The disposition column is the derived product label for each status."
          />
          <div className="p-[var(--ss-space-4)]">
            <AccessibleDataTable
              caption="Component counts per lot, broken down by anomaly status, with links into the filtered component explorer."
              rows={lots}
              rowKey={(r) => r.lotId}
              columns={[
                {
                  key: "lotId",
                  header: "lot_id",
                  render: (r) => (
                    <Link
                      href={`/components?lot_id=${encodeURIComponent(r.lotId)}`}
                      className="ss-mono text-[var(--ss-accent)]"
                    >
                      {r.lotId}
                    </Link>
                  ),
                },
                { key: "total", header: "components", render: (r) => r.total, align: "right" },
                { key: "clean", header: "clean → PASS", render: (r) => r.clean, align: "right" },
                {
                  key: "sporadic",
                  header: "sporadic → MONITOR",
                  render: (r) => r.sporadic,
                  align: "right",
                },
                {
                  key: "persistent",
                  header: "persistent → FLAG",
                  render: (r) => r.persistent,
                  align: "right",
                },
              ]}
            />
          </div>
        </Panel>
      )}

      {/* ── the derivation, stated once ─────────────────────────────── */}
      <Panel>
        <SectionHeader level={3} title="Disposition derivation" />
        <div className="flex flex-col gap-[var(--ss-space-3)] p-[var(--ss-space-4)]">
          <div className="flex flex-wrap items-center gap-[var(--ss-space-4)]">
            {(["clean", "sporadic", "persistent"] as const).map((status) => {
              const d = dispositionFromAnomalyStatus(status);
              return (
                <span key={status} className="flex items-center gap-[var(--ss-space-2)]">
                  <span className="ss-mono text-[var(--ss-text-secondary)]">{status}</span>
                  <span aria-hidden="true" className="text-[var(--ss-text-muted)]">
                    →
                  </span>
                  <StatusChip status={d.disposition} />
                </span>
              );
            })}
          </div>
          <p
            className="text-[var(--ss-text-muted)]"
            style={{
              fontSize: "var(--ss-text-label-size)",
              maxWidth: "var(--ss-measure-prose)",
            }}
          >
            {dispositionFromAnomalyStatus("clean").rule} EARLY REJECT is not shown at lot
            level because it requires per-investigation acceptance-limit results.
          </p>
        </div>
      </Panel>
    </>
  );
}
