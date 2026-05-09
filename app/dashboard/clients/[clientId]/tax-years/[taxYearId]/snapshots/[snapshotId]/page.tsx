"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../../../lib/supabaseClient";
import { EvidenceSection } from "../../../../../../../components/forensics/EvidenceSection";
import { EvidenceStatusPill } from "../../../../../../../components/forensics/EvidenceStatusPill";
import { HashEvidenceGrid } from "../../../../../../../components/forensics/HashEvidenceGrid";
import { ImmutableBanner } from "../../../../../../../components/forensics/ImmutableBanner";
import { JsonEvidenceCard } from "../../../../../../../components/forensics/JsonEvidenceCard";
import { LineagePanel } from "../../../../../../../components/forensics/LineagePanel";
import { buildSnapshotEvidencePack } from "../../../../../../../../lib/forensics/buildSnapshotEvidencePack";

type Row = Record<string, any>;

function money(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function dateTime(value: any) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-GB");
}

export default function SnapshotDetailPage() {
  const params = useParams();

  const clientId = String(params.clientId || "");
  const taxYearId = String(params.taxYearId || "");
  const snapshotId = String(params.snapshotId || "");

  const [snapshot, setSnapshot] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSnapshot() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("hmrc_submission_snapshots")
        .select("*")
        .eq("id", snapshotId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .maybeSingle();

      if (error || !data) {
        setMessage(error?.message || "Snapshot not found.");
        setSnapshot(null);
      } else {
        setSnapshot(data);
      }

      setLoading(false);
    }

    if (clientId && taxYearId && snapshotId) loadSnapshot();
  }, [clientId, taxYearId, snapshotId]);

  const evidencePack = useMemo(() => {
    if (!snapshot) return null;
    return buildSnapshotEvidencePack(snapshot);
  }, [snapshot]);

  if (loading) {
    return (
      <main style={styles.page}>
        <EvidenceSection title="Loading">
          Loading forensic snapshot evidence...
        </EvidenceSection>
      </main>
    );
  }

  if (!snapshot || !evidencePack) {
    return (
      <main style={styles.page}>
        <h1 style={styles.title}>Snapshot not found</h1>
        {message && <div style={styles.error}>{message}</div>}
        <Link
          href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
          style={styles.secondaryButton}
        >
          Back to Summary
        </Link>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link
            href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
            style={styles.backLink}
          >
            ← Back to Tax Year Summary
          </Link>

          <p style={styles.kicker}>Read-only forensic evidence object</p>
          <h1 style={styles.title}>Immutable HMRC Snapshot Viewer</h1>

          <p style={styles.subtitle}>
            Snapshot ID:{" "}
            <strong style={styles.monospace}>{evidencePack.snapshotId}</strong>
          </p>
        </div>

        <ImmutableBanner />
      </div>

      {evidencePack.warnings.length > 0 && (
        <section style={styles.warningCard}>
          <h2 style={styles.warningTitle}>Evidence Review Warnings</h2>
          <p style={styles.warningText}>
            These warnings do not edit the record. They highlight forensic
            evidence gaps that should be reviewed before HMRC production use.
          </p>

          <div style={styles.pillGrid}>
            {evidencePack.warnings.map((check: any) => (
              <EvidenceStatusPill
                key={check.key}
                ok={false}
                label={check.label}
              />
            ))}
          </div>
        </section>
      )}

      <EvidenceSection title="Evidence Integrity Checklist">
        <div style={styles.pillGrid}>
          {evidencePack.checks.map((check: any) => (
            <EvidenceStatusPill
              key={check.key}
              ok={check.ok}
              label={check.label}
            />
          ))}
        </div>
      </EvidenceSection>

      <section style={styles.grid}>
        <EvidenceSection title="Submission Identity">
          <dl style={styles.dl}>
            <dt>Type</dt>
            <dd>{evidencePack.identity.submissionType}</dd>
            <dt>Status</dt>
            <dd>{evidencePack.identity.workflowStatus}</dd>
            <dt>Environment</dt>
            <dd>{evidencePack.identity.environment}</dd>
            <dt>Attempt</dt>
            <dd>{evidencePack.identity.submissionAttempt}</dd>
            <dt>Source route</dt>
            <dd>{evidencePack.identity.sourceRoute || "Not recorded"}</dd>
            <dt>Source table</dt>
            <dd>{evidencePack.identity.sourceTable || "Not recorded"}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="HMRC References">
          <dl style={styles.dl}>
            <dt>Correlation ID</dt>
            <dd>{evidencePack.hmrcReferences.correlationId || "Not recorded"}</dd>
            <dt>Submission ID</dt>
            <dd>{evidencePack.hmrcReferences.submissionId || "Not recorded"}</dd>
            <dt>Amendment ID</dt>
            <dd>{evidencePack.hmrcReferences.amendmentId || "Not recorded"}</dd>
            <dt>Idempotency Key</dt>
            <dd>{evidencePack.hmrcReferences.idempotencyKey}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="Actor + RBAC Evidence">
          <dl style={styles.dl}>
            <dt>Submitted by</dt>
            <dd>
              {evidencePack.actor.submittedByEmail ||
                evidencePack.actor.submittedBy ||
                "Not recorded"}
            </dd>
            <dt>Role</dt>
            <dd>{evidencePack.actor.submittedByRole || "Not recorded"}</dd>
            <dt>Submitted at</dt>
            <dd>{dateTime(evidencePack.actor.submittedAt)}</dd>
            <dt>Locked at</dt>
            <dd>{dateTime(evidencePack.actor.lockedAt)}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="Financial Snapshot">
          <dl style={styles.dl}>
            <dt>Income</dt>
            <dd>{money(evidencePack.financials.incomeTotal)}</dd>
            <dt>Expenses</dt>
            <dd>{money(evidencePack.financials.expenseTotal)}</dd>
            <dt>Profit</dt>
            <dd>{money(evidencePack.financials.profitTotal)}</dd>
            <dt>Transactions</dt>
            <dd>{evidencePack.financials.transactionCount}</dd>
          </dl>
        </EvidenceSection>
      </section>

      <EvidenceSection title="Hash Chain Evidence">
        <HashEvidenceGrid
          items={[
            { label: "Payload Hash", value: evidencePack.hashes.payloadHash },
            { label: "Ledger Hash", value: evidencePack.hashes.ledgerHash },
            { label: "Totals Hash", value: evidencePack.hashes.totalsHash },
            {
              label: "Submission Hash",
              value: evidencePack.hashes.submissionHash,
            },
          ]}
        />
      </EvidenceSection>

      <EvidenceSection title="Amendment / Replay Lineage">
        <LineagePanel
          reason={evidencePack.lineage.amendmentReason}
          items={[
            {
              label: "Amendment Record",
              value: evidencePack.lineage.amendmentId,
              fallback: "Not an amendment",
            },
            {
              label: "Original Snapshot",
              value: evidencePack.lineage.originalSnapshotId,
              href: evidencePack.lineage.originalSnapshotId
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${evidencePack.lineage.originalSnapshotId}`
                : undefined,
              fallback: "Not recorded",
            },
            {
              label: "Previous Snapshot",
              value: evidencePack.lineage.previousSnapshotId,
              href: evidencePack.lineage.previousSnapshotId
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${evidencePack.lineage.previousSnapshotId}`
                : undefined,
              fallback: "Not recorded",
            },
            {
              label: "Replay Of",
              value: evidencePack.lineage.replayOfSnapshotId,
              href: evidencePack.lineage.replayOfSnapshotId
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${evidencePack.lineage.replayOfSnapshotId}`
                : undefined,
              fallback: "Not replayed",
            },
          ]}
        />
      </EvidenceSection>

      <JsonEvidenceCard
        title="Canonical Evidence Pack"
        value={evidencePack}
        defaultOpen={false}
      />
      <JsonEvidenceCard
        title="Original Totals"
        value={evidencePack.financials.originalTotals}
      />
      <JsonEvidenceCard
        title="Adjustment Totals"
        value={evidencePack.financials.adjustmentTotals}
      />
      <JsonEvidenceCard
        title="Submitted Totals"
        value={evidencePack.financials.submittedTotals}
      />
      <JsonEvidenceCard
        title="Immutable HMRC Payload"
        value={evidencePack.rawEvidence.hmrcPayload}
      />
      <JsonEvidenceCard
        title="Immutable HMRC Response"
        value={evidencePack.rawEvidence.hmrcResponse}
      />
      <JsonEvidenceCard
        title="Fraud Prevention Headers"
        value={evidencePack.rawEvidence.fraudHeaders}
      />
      <JsonEvidenceCard
        title="OAuth Context"
        value={evidencePack.rawEvidence.oauthContext}
      />
      <JsonEvidenceCard
        title="Tenant Context"
        value={evidencePack.rawEvidence.tenantContext}
      />
      <JsonEvidenceCard
        title="Audit Context"
        value={evidencePack.rawEvidence.auditContext}
      />
      <JsonEvidenceCard
        title="Transaction Snapshot"
        value={evidencePack.rawEvidence.transactionSnapshot}
      />
      <JsonEvidenceCard
        title="Source Totals Snapshot"
        value={evidencePack.rawEvidence.sourceTotalsSnapshot}
      />
      <JsonEvidenceCard
        title="Batch Snapshot"
        value={evidencePack.rawEvidence.batchSnapshot}
      />
      <JsonEvidenceCard
        title="Digital Link Metadata"
        value={evidencePack.rawEvidence.digitalLinkMetadata}
      />
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: 32,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
  },
  kicker: {
    margin: "16px 0 4px",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 34,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  dl: {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: "10px 14px",
    margin: 0,
    wordBreak: "break-word",
  },
  monospace: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  warningCard: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  warningTitle: {
    margin: "0 0 8px",
    color: "#92400e",
    fontSize: 20,
    fontWeight: 900,
  },
  warningText: {
    margin: "0 0 14px",
    color: "#78350f",
    fontWeight: 700,
  },
  pillGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    fontWeight: 800,
  },
};