import { AccessibleDataTable } from "@/components/AccessibleDataTable";
import { DemonstrationCase } from "@/components/DemonstrationCase";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MetricValue } from "@/components/MetricValue";
import { Panel, SectionHeader } from "@/components/Panel";
import { RegisterBadge } from "@/components/RegisterValue";
import { StatusChip } from "@/components/StatusChip";
import { getCorpus } from "@/lib/api/endpoints";
import {
  KNOWLEDGE_BASE_COVERAGE,
  KNOWLEDGE_BASE_NAME,
  PRODUCT_NAME,
} from "@/lib/copy/product";

export const metadata = { title: `${KNOWLEDGE_BASE_NAME} — ${PRODUCT_NAME}` };

/**
 * Engineering Reliability Knowledge Base.
 *
 * Deliberately NOT called a burn-in knowledge base. The corpus coverage report
 * (knowledge_base/reports/corpus-coverage.md) records that HTOL is covered by a
 * single document incidentally, that no corpus document reports an HTOL test
 * programme of its own, and that the dedicated screening standards JESD22-A108
 * and AEC-Q101 are paywalled and absent. The coverage caveat is therefore shown
 * on the page rather than buried in a doc.
 *
 * Every document listed here comes from `GET /corpus`, which reads
 * `knowledge_base/metadata/corpus.json`. Nothing is added, renamed or invented,
 * and each document keeps its real verification status — including the ones that
 * are NOT available, since hiding them would overstate the corpus.
 */
export default async function KnowledgeBasePage() {
  const corpusResult = await getCorpus();
  const corpus = corpusResult.kind === "ok" ? corpusResult.data : null;

  const documents = corpus?.documents ?? [];
  const verified = documents.filter((d) => d.verification_status === "VERIFIED");

  return (
    <>
      <Panel>
        <SectionHeader
          level={1}
          title={KNOWLEDGE_BASE_NAME}
          subtitle="The evidence corpus the Evidence Agent retrieves from. Every citation in an investigation resolves to a document listed here."
          actions={<RegisterBadge register="RETRIEVED_EVIDENCE" />}
        />
        <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)]">
          {!corpus ? (
            <>
              <EmptyState
                state="NO_EVIDENCE"
                body="The corpus manifest could not be read."
                detail="knowledge_base/metadata/corpus.json — scripts/ingest_knowledge.py"
              />
              <ErrorState result={corpusResult} />
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-[var(--ss-space-4)]">
                <MetricValue label="Documents in manifest" value={corpus.n_documents} register="DATA" />
                <MetricValue label="VERIFIED" value={verified.length} register="DATA" />
                <MetricValue
                  label="Indexed chunks"
                  value={corpus.collection.chunk_count}
                  register="RETRIEVED_EVIDENCE"
                  note={corpus.collection.reachable ? "vector store reachable" : "vector store unreachable"}
                />
                <MetricValue
                  label="Collection"
                  value={corpus.collection.collection}
                  register="RETRIEVED_EVIDENCE"
                />
              </div>

              {/* ── the coverage caveat, visible and concise ────────── */}
              <div
                className="border-l-2 border-[var(--ss-border-strong)] pl-[var(--ss-space-3)]"
              >
                <span className="ss-field-label">Coverage</span>
                <p
                  className="text-[var(--ss-text-secondary)]"
                  style={{ maxWidth: "var(--ss-measure-prose)" }}
                >
                  {KNOWLEDGE_BASE_COVERAGE}
                </p>
              </div>

              {corpus.note && (
                <div className="flex flex-col gap-[var(--ss-space-1)]">
                  <span className="ss-field-label">
                    Corpus manifest note — verbatim
                  </span>
                  <blockquote
                    className="border-l border-[var(--ss-border-subtle)] pl-[var(--ss-space-3)] text-[var(--ss-text-muted)]"
                    style={{
                      fontSize: "var(--ss-text-label-size)",
                      maxWidth: "var(--ss-measure-prose)",
                    }}
                  >
                    {corpus.note}
                  </blockquote>
                  <span
                    className="text-[var(--ss-text-muted)]"
                    style={{ fontSize: "var(--ss-text-label-size)" }}
                  >
                    Quoted unchanged from{" "}
                    <span className="ss-mono">knowledge_base/metadata/corpus.json</span>. It
                    records how each document was obtained and verified, and uses the internal
                    project name rather than the product name. The manifest is not edited for
                    presentation.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>

      <DemonstrationCase variant="panel" showDatasetNote={false} />

      {corpus && (
        <Panel>
          <SectionHeader
            level={3}
            title="Documents"
            subtitle="Verification status is the corpus manifest's own value. Documents that could not be obtained are listed rather than hidden."
          />
          <div className="p-[var(--ss-space-4)]">
            <AccessibleDataTable
              caption="Knowledge base documents with source organization, type and verification status."
              rows={documents}
              rowKey={(d) => d.document_id}
              columns={[
                {
                  key: "title",
                  header: "title",
                  render: (d) => (
                    <span className="text-[var(--ss-text-primary)]">{d.title}</span>
                  ),
                },
                {
                  key: "organization",
                  header: "organization",
                  render: (d) => d.organization ?? "not recorded",
                },
                {
                  key: "source_type",
                  header: "type",
                  render: (d) => <span className="ss-mono">{d.source_type}</span>,
                },
                {
                  key: "publication_year",
                  header: "year",
                  render: (d) => d.publication_year ?? "—",
                  align: "right",
                },
                {
                  key: "verification_status",
                  header: "verification",
                  render: (d) => <StatusChip status={d.verification_status} />,
                },
              ]}
            />
          </div>
        </Panel>
      )}
    </>
  );
}
