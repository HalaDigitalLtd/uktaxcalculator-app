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

function countItems(value: any) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
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

  const checks = useMemo(() => {
    if (!snapshot) return [];

    return [
      { label: "Payload hash preserved", ok: Boolean(snapshot.payload_hash) },
      { label: "Ledger hash preserved", ok: Boolean(snapshot.ledger_hash) },
      { label: "Totals hash preserved", ok: Boolean(snapshot.totals_hash) },
      { label: "HMRC payload preserved", ok: countItems(snapshot.hmrc_payload) > 0 },
      { label: "HMRC response preserved", ok: countItems(snapshot.hmrc_response) > 0 },
      { label: "Fraud headers preserved", ok: countItems(snapshot.fraud_headers) > 0 },
      { label: "Tenant context preserved", ok: countItems(snapshot.tenant_context) > 0 },
      { label: "Audit context preserved", ok: countItems(snapshot.audit_context) > 0 },
      { label: "Submitted actor role preserved", ok: Boolean(snapshot.submitted_by_role) },
      { label: "Digital link metadata present", ok: countItems(snapshot.digital_link_metadata) > 0 },
      { label: "Transaction snapshot present", ok: countItems(snapshot.transaction_snapshot) > 0 },
      { label: "Batch snapshot present", ok: countItems(snapshot.batch_snapshot) > 0 },
    ];
  }, [snapshot]);

  const failedChecks = checks.filter((c) => !c.ok);

  if (loading) {
    return (
      <main style={styles.page}>
        <EvidenceSection title="Loading">Loading forensic snapshot evidence...</EvidenceSection>
      </main>
    );
  }

  if (!snapshot) {
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
            Snapshot ID: <strong style={styles.monospace}>{snapshot.id}</strong>
          </p>
        </div>

        <ImmutableBanner />
      </div>

      {failedChecks.length > 0 && (
        <section style={styles.warningCard}>
          <h2 style={styles.warningTitle}>Evidence Review Warnings</h2>
          <p style={styles.warningText}>
            These warnings do not edit the record. They highlight forensic
            evidence gaps that should be reviewed before HMRC production use.
          </p>

          <div style={styles.pillGrid}>
            {failedChecks.map((check) => (
              <EvidenceStatusPill
                key={check.label}
                ok={false}
                label={check.label}
              />
            ))}
          </div>
        </section>
      )}

      <EvidenceSection title="Evidence Integrity Checklist">
        <div style={styles.pillGrid}>
          {checks.map((check) => (
            <EvidenceStatusPill
              key={check.label}
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
            <dd>{snapshot.submission_type}</dd>
            <dt>Status</dt>
            <dd>{snapshot.workflow_status}</dd>
            <dt>Environment</dt>
            <dd>{snapshot.environment}</dd>
            <dt>Attempt</dt>
            <dd>{snapshot.submission_attempt}</dd>
            <dt>Source route</dt>
            <dd>{snapshot.source_route || "Not recorded"}</dd>
            <dt>Source table</dt>
            <dd>{snapshot.source_table || "Not recorded"}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="HMRC References">
          <dl style={styles.dl}>
            <dt>Correlation ID</dt>
            <dd>{snapshot.hmrc_correlation_id || "Not recorded"}</dd>
            <dt>Submission ID</dt>
            <dd>{snapshot.hmrc_submission_id || "Not recorded"}</dd>
            <dt>Amendment ID</dt>
            <dd>{snapshot.hmrc_amendment_id || "Not recorded"}</dd>
            <dt>Idempotency Key</dt>
            <dd>{snapshot.idempotency_key}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="Actor + RBAC Evidence">
          <dl style={styles.dl}>
            <dt>Submitted by</dt>
            <dd>
              {snapshot.submitted_by_email ||
                snapshot.submitted_by ||
                "Not recorded"}
            </dd>
            <dt>Role</dt>
            <dd>{snapshot.submitted_by_role || "Not recorded"}</dd>
            <dt>Submitted at</dt>
            <dd>{dateTime(snapshot.submitted_at)}</dd>
            <dt>Locked at</dt>
            <dd>{dateTime(snapshot.locked_at)}</dd>
          </dl>
        </EvidenceSection>

        <EvidenceSection title="Financial Snapshot">
          <dl style={styles.dl}>
            <dt>Income</dt>
            <dd>{money(snapshot.income_total)}</dd>
            <dt>Expenses</dt>
            <dd>{money(snapshot.expense_total)}</dd>
            <dt>Profit</dt>
            <dd>{money(snapshot.profit_total)}</dd>
            <dt>Transactions</dt>
            <dd>{snapshot.transaction_count}</dd>
          </dl>
        </EvidenceSection>
      </section>

      <EvidenceSection title="Hash Chain Evidence">
        <HashEvidenceGrid
          items={[
            { label: "Payload Hash", value: snapshot.payload_hash },
            { label: "Ledger Hash", value: snapshot.ledger_hash },
            { label: "Totals Hash", value: snapshot.totals_hash },
            { label: "Submission Hash", value: snapshot.submission_hash },
          ]}
        />
      </EvidenceSection>

      <EvidenceSection title="Amendment / Replay Lineage">
        <LineagePanel
          reason={snapshot.amendment_reason}
          items={[
            {
              label: "Amendment Record",
              value: snapshot.amendment_id,
              fallback: "Not an amendment",
            },
            {
              label: "Original Snapshot",
              value: snapshot.original_snapshot_id,
              href: snapshot.original_snapshot_id
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${snapshot.original_snapshot_id}`
                : undefined,
              fallback: "Not recorded",
            },
            {
              label: "Previous Snapshot",
              value: snapshot.previous_snapshot_id,
              href: snapshot.previous_snapshot_id
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${snapshot.previous_snapshot_id}`
                : undefined,
              fallback: "Not recorded",
            },
            {
              label: "Replay Of",
              value: snapshot.replay_of_snapshot_id,
              href: snapshot.replay_of_snapshot_id
                ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/snapshots/${snapshot.replay_of_snapshot_id}`
                : undefined,
              fallback: "Not replayed",
            },
          ]}
        />
      </EvidenceSection>

      <JsonEvidenceCard title="Original Totals" value={snapshot.original_totals} />
      <JsonEvidenceCard title="Adjustment Totals" value={snapshot.adjustment_totals} />
      <JsonEvidenceCard title="Submitted Totals" value={snapshot.submitted_totals} />
      <JsonEvidenceCard title="Immutable HMRC Payload" value={snapshot.hmrc_payload} />
      <JsonEvidenceCard title="Immutable HMRC Response" value={snapshot.hmrc_response} />
      <JsonEvidenceCard title="Fraud Prevention Headers" value={snapshot.fraud_headers} />
      <JsonEvidenceCard title="OAuth Context" value={snapshot.oauth_context} />
      <JsonEvidenceCard title="Tenant Context" value={snapshot.tenant_context} />
      <JsonEvidenceCard title="Audit Context" value={snapshot.audit_context} />
      <JsonEvidenceCard title="Transaction Snapshot" value={snapshot.transaction_snapshot} />
      <JsonEvidenceCard title="Source Totals Snapshot" value={snapshot.source_totals_snapshot} />
      <JsonEvidenceCard title="Batch Snapshot" value={snapshot.batch_snapshot} />
      <JsonEvidenceCard title="Digital Link Metadata" value={snapshot.digital_link_metadata} />
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