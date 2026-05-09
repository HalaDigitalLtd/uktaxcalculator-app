"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { buildSnapshotEvidencePack } from "../../../lib/forensics/buildSnapshotEvidencePack";

type Row = Record<string, any>;

function formatDate(value: any) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB");
}

export default function ForensicsDashboardPage() {
  const [snapshots, setSnapshots] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/auth/login";
      return;
    }

    const { data, error } = await supabase
      .from("hmrc_submission_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      setSnapshots([]);
    } else {
      setSnapshots(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const packs = useMemo(() => {
    return snapshots.map((snapshot) => ({
      snapshot,
      pack: buildSnapshotEvidencePack(snapshot),
    }));
  }, [snapshots]);

  const stats = useMemo(() => {
    const criticalAlerts = packs.reduce(
      (sum, item) => sum + item.pack.operationalAlerts.alerts.filter((a: any) => a.severity === "critical").length,
      0
    );

    const evidenceGaps = packs.filter((item) => item.pack.warnings.length > 0).length;

    const replayRisks = packs.filter(
      (item) =>
        item.pack.lineage.isReplayed &&
        !item.pack.lineage.replayOfSnapshotId
    ).length;

    const digitalLinkFailures = packs.filter(
      (item) =>
        item.pack.digitalLinkValidation.validationStatus !==
        "digital_link_validated"
    ).length;

    const highRiskAmendments = packs.filter(
      (item) =>
        item.pack.identity.submissionType === "amendment" &&
        ["high", "critical"].includes(item.pack.evidenceRisk.riskLevel)
    ).length;

    const tamperRiskFlags = packs.filter(
      (item) => item.pack.tamperRisk.riskLevel !== "low"
    ).length;

    return {
      totalSnapshots: packs.length,
      criticalAlerts,
      evidenceGaps,
      replayRisks,
      digitalLinkFailures,
      highRiskAmendments,
      tamperRiskFlags,
    };
  }, [packs]);

  const investigationFeed = useMemo(() => {
    return packs
      .flatMap((item) =>
        item.pack.operationalAlerts.alerts.map((alert: any) => ({
          alert,
          snapshot: item.snapshot,
          pack: item.pack,
        }))
      )
      .sort((a, b) => {
        const weight: Record<string, number> = {
          critical: 4,
          high: 3,
          warning: 2,
          info: 1,
        };

        return weight[b.alert.severity] - weight[a.alert.severity];
      });
  }, [packs]);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>HMRC Forensic Operations</p>
            <h1 style={styles.title}>Forensic Control Centre</h1>
            <p style={styles.subtitle}>
              Global monitoring for immutable HMRC evidence, amendment lineage,
              replay risk, digital-link compliance and operational
              investigation workflows.
            </p>
          </div>

          <button onClick={loadData} style={styles.secondaryButton}>
            Refresh
          </button>
        </div>

        {message && <div style={styles.error}>{message}</div>}

        {loading ? (
          <div style={styles.card}>Loading forensic operations...</div>
        ) : (
          <>
            <section style={styles.statsGrid}>
              <StatCard label="Total snapshots" value={stats.totalSnapshots} />
              <StatCard label="Critical alerts" value={stats.criticalAlerts} />
              <StatCard label="Evidence gaps" value={stats.evidenceGaps} />
              <StatCard label="Replay risks" value={stats.replayRisks} />
              <StatCard
                label="Digital link failures"
                value={stats.digitalLinkFailures}
              />
              <StatCard
                label="High risk amendments"
                value={stats.highRiskAmendments}
              />
              <StatCard
                label="Tamper risk flags"
                value={stats.tamperRiskFlags}
              />
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Operational Investigation Feed</h2>

              {investigationFeed.length === 0 ? (
                <p style={styles.clean}>
                  No forensic operational alerts detected.
                </p>
              ) : (
                <div style={styles.feed}>
                  {investigationFeed.map((item, index) => (
                    <div key={`${item.snapshot.id}-${item.alert.key}-${index}`} style={styles.feedRow}>
                      <div>
                        <span style={badgeStyle(item.alert.severity)}>
                          {item.alert.severity.toUpperCase()}
                        </span>
                        <h3 style={styles.feedTitle}>{item.alert.title}</h3>
                        <p style={styles.feedDescription}>
                          {item.alert.description}
                        </p>
                        <p style={styles.meta}>
                          {item.pack.identity.submissionType} ·{" "}
                          {item.pack.identity.environment} · Created{" "}
                          {formatDate(item.snapshot.created_at)}
                        </p>
                      </div>

                      <div style={styles.feedActions}>
                        <div style={styles.scoreBox}>
                          <span style={styles.scoreLabel}>Risk score</span>
                          <strong style={styles.scoreValue}>
                            {item.pack.evidenceRisk.score}
                          </strong>
                        </div>

                        <Link
                          href={`/dashboard/clients/${item.snapshot.client_id}/tax-years/${item.snapshot.tax_year_id}/snapshots/${item.snapshot.id}`}
                          style={styles.openButton}
                        >
                          Open Snapshot
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function badgeStyle(severity: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    marginBottom: 8,
  };

  if (severity === "critical") {
    return { ...base, background: "#fee2e2", color: "#991b1b" };
  }

  if (severity === "high") {
    return { ...base, background: "#ffedd5", color: "#9a3412" };
  }

  if (severity === "warning") {
    return { ...base, background: "#fef3c7", color: "#92400e" };
  }

  return { ...base, background: "#dbeafe", color: "#1e40af" };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 32,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  container: {
    maxWidth: 1400,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 28,
  },
  kicker: {
    margin: "0 0 8px",
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 12,
  },
  title: {
    margin: 0,
    fontSize: 42,
    fontWeight: 900,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 14,
    maxWidth: 900,
    color: "#475569",
    lineHeight: 1.7,
    fontSize: 16,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
    marginBottom: 28,
  },
  statCard: {
    background: "white",
    borderRadius: 20,
    padding: 22,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 34,
    fontWeight: 900,
    color: "#0f172a",
  },
  card: {
    background: "white",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    padding: 28,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    marginTop: 0,
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },
  feed: {
    display: "grid",
    gap: 14,
  },
  feedRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    background: "#fbfdff",
  },
  feedTitle: {
    margin: "0 0 6px",
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  feedDescription: {
    margin: "0 0 8px",
    color: "#475569",
    lineHeight: 1.6,
    fontWeight: 600,
  },
  meta: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },
  feedActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  scoreBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "10px 12px",
    minWidth: 90,
    textAlign: "center",
  },
  scoreLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 900,
  },
  openButton: {
    background: "#111827",
    color: "white",
    textDecoration: "none",
    borderRadius: 12,
    padding: "11px 14px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  clean: {
    background: "#ecfdf5",
    border: "1px solid #10b981",
    color: "#065f46",
    padding: 18,
    borderRadius: 16,
    fontWeight: 800,
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