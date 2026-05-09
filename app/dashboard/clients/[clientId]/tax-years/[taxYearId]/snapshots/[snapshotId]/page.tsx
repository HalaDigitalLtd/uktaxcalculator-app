"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

function money(value: any) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function dateTime(value: any) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-GB");
}

function JsonCard({ title, value }: { title: string; value: any }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <pre style={styles.pre}>{JSON.stringify(value ?? {}, null, 2)}</pre>
    </section>
  );
}

export default function SnapshotDetailPage() {
  const params = useParams();

  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;
  const snapshotId = params.snapshotId as string;

  const [snapshot, setSnapshot] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSnapshot() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("hmrc_submission_snapshots")
        .select("*")
        .eq("id", snapshotId)
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .single();

      if (error) {
        setError(error.message);
        setSnapshot(null);
      } else {
        setSnapshot(data);
      }

      setLoading(false);
    }

    if (clientId && taxYearId && snapshotId) {
      loadSnapshot();
    }
  }, [clientId, taxYearId, snapshotId]);

  const warnings = useMemo(() => {
    if (!snapshot) return [];

    const items: string[] = [];

    if (!snapshot.payload_hash) items.push("Missing payload hash.");
    if (!snapshot.ledger_hash) items.push("Missing ledger hash.");
    if (!snapshot.fraud_headers || Object.keys(snapshot.fraud_headers).length === 0) {
      items.push("Fraud prevention headers are missing.");
    }
    if (!snapshot.transaction_snapshot || snapshot.transaction_snapshot.length === 0) {
      items.push("Transaction snapshot is empty. This may be valid for some final/amendment records, but should be reviewed for digital-link evidence.");
    }
    if (!snapshot.source_totals_snapshot || Object.keys(snapshot.source_totals_snapshot).length === 0) {
      items.push("Source totals snapshot is empty.");
    }
    if (!snapshot.batch_snapshot || snapshot.batch_snapshot.length === 0) {
      items.push("Batch snapshot is empty.");
    }
    if (!snapshot.submitted_by_role) {
      items.push("Submitted-by role is missing. RBAC evidence should be preserved for all HMRC submissions.");
    }

    return items;
  }, [snapshot]);

  if (loading) {
    return <main style={styles.page}>Loading immutable snapshot...</main>;
  }

  if (error || !snapshot) {
    return (
      <main style={styles.page}>
        <h1 style={styles.title}>Snapshot not found</h1>
        <p style={styles.error}>{error || "No snapshot record found."}</p>
        <Link href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}>
          Back to tax year summary
        </Link>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Immutable HMRC Evidence Snapshot</p>
          <h1 style={styles.title}>{snapshot.submission_type?.toUpperCase()} Snapshot</h1>
          <p style={styles.subtitle}>
            Snapshot ID: <code>{snapshot.id}</code>
          </p>
        </div>

        <Link
          href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
          style={styles.secondaryButton}
        >
          Back to Summary
        </Link>
      </div>

      {warnings.length > 0 && (
        <section style={styles.warningCard}>
          <h2 style={styles.warningTitle}>Evidence Review Warnings</h2>
          <ul style={styles.warningList}>
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Submission Identity</h2>
          <dl style={styles.dl}>
            <dt>Environment</dt>
            <dd>{snapshot.environment}</dd>
            <dt>Status</dt>
            <dd>{snapshot.workflow_status}</dd>
            <dt>Attempt</dt>
            <dd>{snapshot.submission_attempt}</dd>
            <dt>Source Route</dt>
            <dd>{snapshot.source_route || "Not recorded"}</dd>
            <dt>Source Table</dt>
            <dd>{snapshot.source_table || "Not recorded"}</dd>
            <dt>Source Record</dt>
            <dd>{snapshot.source_record_id || "Not recorded"}</dd>
          </dl>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>HMRC References</h2>
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
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Hash Evidence</h2>
          <dl style={styles.dl}>
            <dt>Payload Hash</dt>
            <dd>{snapshot.payload_hash}</dd>
            <dt>Ledger Hash</dt>
            <dd>{snapshot.ledger_hash || "Not recorded"}</dd>
            <dt>Totals Hash</dt>
            <dd>{snapshot.totals_hash || "Not recorded"}</dd>
            <dt>Submission Hash</dt>
            <dd>{snapshot.submission_hash || "Not recorded"}</dd>
          </dl>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Actor Evidence</h2>
          <dl style={styles.dl}>
            <dt>Submitted By</dt>
            <dd>{snapshot.submitted_by_email || snapshot.submitted_by || "Not recorded"}</dd>
            <dt>Role</dt>
            <dd>{snapshot.submitted_by_role || "Not recorded"}</dd>
            <dt>Submitted At</dt>
            <dd>{dateTime(snapshot.submitted_at)}</dd>
            <dt>Locked At</dt>
            <dd>{dateTime(snapshot.locked_at)}</dd>
          </dl>
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Financial Totals</h2>
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
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Amendment Lineage</h2>
          <dl style={styles.dl}>
            <dt>Amendment Record</dt>
            <dd>{snapshot.amendment_id || "Not an amendment"}</dd>
            <dt>Original Snapshot</dt>
            <dd>{snapshot.original_snapshot_id || "Not recorded"}</dd>
            <dt>Previous Snapshot</dt>
            <dd>{snapshot.previous_snapshot_id || "Not recorded"}</dd>
            <dt>Replay Of</dt>
            <dd>{snapshot.replay_of_snapshot_id || "Not replayed"}</dd>
            <dt>Reason</dt>
            <dd>{snapshot.amendment_reason || "Not recorded"}</dd>
          </dl>
        </div>
      </section>

      <JsonCard title="Original Totals" value={snapshot.original_totals} />
      <JsonCard title="Adjustment Totals" value={snapshot.adjustment_totals} />
      <JsonCard title="Submitted Totals" value={snapshot.submitted_totals} />
      <JsonCard title="Immutable HMRC Payload" value={snapshot.hmrc_payload} />
      <JsonCard title="Immutable HMRC Response" value={snapshot.hmrc_response} />
      <JsonCard title="Fraud Prevention Headers" value={snapshot.fraud_headers} />
      <JsonCard title="OAuth Context" value={snapshot.oauth_context} />
      <JsonCard title="Tenant Context" value={snapshot.tenant_context} />
      <JsonCard title="Audit Context" value={snapshot.audit_context} />
      <JsonCard title="Transaction Snapshot" value={snapshot.transaction_snapshot} />
      <JsonCard title="Source Totals Snapshot" value={snapshot.source_totals_snapshot} />
      <JsonCard title="Batch Snapshot" value={snapshot.batch_snapshot} />
      <JsonCard title="Digital Link Metadata" value={snapshot.digital_link_metadata} />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 32,
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 24,
  },
  kicker: {
    margin: 0,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "6px 0",
    fontSize: 32,
  },
  subtitle: {
    margin: 0,
    color: "#4b5563",
  },
  secondaryButton: {
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    color: "#111827",
    textDecoration: "none",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    margin: "0 0 14px",
    fontSize: 18,
  },
  dl: {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: "10px 14px",
    margin: 0,
    wordBreak: "break-word",
  },
  pre: {
    margin: 0,
    padding: 14,
    background: "#0f172a",
    color: "#e5e7eb",
    borderRadius: 10,
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.5,
    maxHeight: 520,
  },
  warningCard: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  warningTitle: {
    margin: "0 0 10px",
    color: "#92400e",
  },
  warningList: {
    margin: 0,
    paddingLeft: 20,
    color: "#78350f",
  },
  error: {
    color: "#b91c1c",
  },
};