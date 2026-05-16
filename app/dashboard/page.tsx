"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { authenticatedFetch } from "../../lib/authenticatedFetch";

type Metric = {
  label: string;
  value: number | string;
  tone: "green" | "amber" | "red" | "blue" | "slate";
  helper: string;
};

type Item = {
  id: string;
  title: string;
  description: string;
  status: string;
  href?: string | null;
  createdAt?: string | null;
};

type Dashboard = {
  success: boolean;
  generatedAt: string;
  firmId: string;
  metrics: Metric[];
  queues: {
    failedSubmissions: Item[];
    partnerApprovals: Item[];
    overdueObligations: Item[];
    hmrcSyncWarnings: Item[];
    auditAlerts: Item[];
  };
  activity: Item[];
  warnings: string[];
};

function getStoredFirmId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("impersonate_firm_id") || localStorage.getItem("active_firm_id") || null;
}

function toneColour(tone: Metric["tone"]) {
  if (tone === "red") return "#dc2626";
  if (tone === "amber") return "#d97706";
  if (tone === "green") return "#059669";
  if (tone === "blue") return "#2563eb";
  return "#475569";
}

function formatDate(value?: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function DashboardHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [isHalaAdmin, setIsHalaAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
          router.replace("/auth/login");
          return;
        }

        setUserEmail(userData.user.email || "");

        const { data: adminCheck } = await supabase.rpc("is_hala_admin");
        if (!cancelled) setIsHalaAdmin(Boolean(adminCheck));

        const { data: resolvedFirmId, error: firmError } = await supabase.rpc(
          "get_current_active_firm_id",
          { impersonated_firm_id: getStoredFirmId() || null }
        );

        if (firmError) throw firmError;

        if (!resolvedFirmId) {
          setFirmId(null);
          setDashboard(null);
          setLoading(false);
          return;
        }

        setFirmId(resolvedFirmId);

        const response = await authenticatedFetch(
          `/api/dashboard/operational?firmId=${encodeURIComponent(resolvedFirmId)}`,
          { method: "GET", cache: "no-store" }
        );

        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Unable to load dashboard.");
        }

        if (!cancelled) {
          setDashboard(payload);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load dashboard.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <div style={styles.notice}>Loading practice control centre...</div>;
  }

  if (isHalaAdmin && !firmId) {
    return (
      <div style={styles.notice}>
        <h1 style={styles.noticeTitle}>Select a firm workspace</h1>
        <p>You are logged in as {userEmail}.</p>
        <Link href="/admin/firms" style={styles.primaryButton}>Open firms</Link>
      </div>
    );
  }

  if (!firmId) {
    return (
      <div style={styles.notice}>
        <h1 style={styles.noticeTitle}>Firm access required</h1>
        <p>Your account is not linked to an active firm workspace.</p>
        <Link href="/auth/register" style={styles.primaryButton}>Register firm</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.notice}>
        <h1 style={styles.noticeTitle}>Dashboard error</h1>
        <p>{error}</p>
      </div>
    );
  }

  const metrics = dashboard?.metrics || [];
  const queues = dashboard?.queues;

  const urgentCount =
    (queues?.overdueObligations.length || 0) +
    (queues?.failedSubmissions.length || 0) +
    (queues?.auditAlerts.length || 0);

  const reviewCount =
    (queues?.partnerApprovals.length || 0) +
    (queues?.hmrcSyncWarnings.length || 0);

  return (
    <div style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Practice control centre</p>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>
            MTD ITSA workload, HMRC risk, review queues and audit evidence health.
          </p>
        </div>

        <div style={styles.headerActions}>
          <Link href="/dashboard/clients" style={styles.primaryButton}>Open clients</Link>
          <Link href="/dashboard/hmrc-connect" style={styles.secondaryButton}>HMRC connect</Link>
        </div>
      </section>

      <section style={styles.commandStrip}>
        <div style={styles.commandItem}>
          <span style={styles.commandLabel}>Urgent</span>
          <strong style={{ ...styles.commandValue, color: urgentCount > 0 ? "#b42318" : "#067647" }}>
            {urgentCount}
          </strong>
          <span style={styles.commandText}>overdue, failed or audit risk</span>
        </div>

        <div style={styles.commandItem}>
          <span style={styles.commandLabel}>Review</span>
          <strong style={{ ...styles.commandValue, color: reviewCount > 0 ? "#b54708" : "#475467" }}>
            {reviewCount}
          </strong>
          <span style={styles.commandText}>approvals and HMRC sync warnings</span>
        </div>

        <div style={styles.commandItem}>
          <span style={styles.commandLabel}>Last refresh</span>
          <strong style={styles.commandValueSmall}>{formatDate(dashboard?.generatedAt)}</strong>
          <span style={styles.commandText}>operational data snapshot</span>
        </div>
      </section>

      <section style={styles.metricsGrid}>
        {metrics.map((metric) => (
          <div key={metric.label} style={styles.metricCard}>
            <div style={styles.metricTop}>
              <span style={{ ...styles.dot, background: toneColour(metric.tone) }} />
              <span style={styles.metricLabel}>{metric.label}</span>
            </div>
            <div style={styles.metricValue}>{metric.value}</div>
            <p style={styles.metricText}>{metric.helper}</p>
          </div>
        ))}
      </section>

      {(dashboard?.warnings || []).length > 0 && (
        <div style={styles.warning}>
          {(dashboard?.warnings || []).slice(0, 2).join(" · ")}
        </div>
      )}

      <section style={styles.grid}>
        <Panel title="Overdue obligations" count={queues?.overdueObligations.length || 0} items={queues?.overdueObligations || []} empty="No overdue obligations." />
        <Panel title="Submission issues" count={queues?.failedSubmissions.length || 0} items={queues?.failedSubmissions || []} empty="No submission issues." />
        <Panel title="Partner approvals" count={queues?.partnerApprovals.length || 0} items={queues?.partnerApprovals || []} empty="No partner approvals waiting." />
        <Panel title="HMRC sync warnings" count={queues?.hmrcSyncWarnings.length || 0} items={queues?.hmrcSyncWarnings || []} empty="No HMRC sync warnings." />
        <Panel title="Audit alerts" count={queues?.auditAlerts.length || 0} items={queues?.auditAlerts || []} empty="No audit alerts." />
        <Panel title="Recent activity" count={dashboard?.activity.length || 0} items={dashboard?.activity || []} empty="No recent activity." />
      </section>
    </div>
  );
}

function Panel({
  title,
  count,
  items,
  empty,
}: {
  title: string;
  count: number;
  items: Item[];
  empty: string;
}) {
  return (
    <details style={styles.panel} open={count > 0}>
      <summary style={styles.panelHeader}>
        <h2 style={styles.panelTitle}>{title}</h2>
        <span
          style={{
            ...styles.count,
            background: count > 0 ? "#fff4ed" : "#f2f4f7",
            color: count > 0 ? "#b54708" : "#475467",
          }}
        >
          {count}
        </span>
      </summary>

      <div style={styles.list}>
        {items.length === 0 ? (
          <div style={styles.empty}>{empty}</div>
        ) : (
          items.slice(0, 4).map((item) => {
            const card = (
              <div style={styles.item}>
                <div style={{ minWidth: 0 }}>
                  <strong style={styles.itemTitle}>{item.title}</strong>
                  <p style={styles.itemText}>{item.description}</p>
                  <p style={styles.itemDate}>{formatDate(item.createdAt)}</p>
                </div>
                <span style={styles.status}>{item.status}</span>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} style={{ textDecoration: "none" }}>
                {card}
              </Link>
            ) : (
              <div key={item.id}>{card}</div>
            );
          })
        )}
      </div>
    </details>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gap: 12,
    color: "#172033",
  },
  header: {
    background: "#ffffff",
    border: "1px solid #e7edf5",
    borderRadius: 18,
    padding: "17px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.035)",
  },
  kicker: {
    margin: 0,
    color: "#667085",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  title: {
    margin: "4px 0 0",
    fontSize: 23,
    lineHeight: 1.15,
    fontWeight: 850,
    letterSpacing: -0.5,
    color: "#111827",
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#667085",
    fontSize: 13,
    lineHeight: 1.45,
  },
  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    background: "#172033",
    color: "white",
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#172033",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #d7dde7",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    whiteSpace: "nowrap",
  },
  commandStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  commandItem: {
    background: "#ffffff",
    border: "1px solid #e7edf5",
    borderRadius: 15,
    padding: "12px 14px",
    display: "grid",
    gap: 3,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  },
  commandLabel: {
    color: "#667085",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  commandValue: {
    fontSize: 24,
    fontWeight: 850,
    letterSpacing: -0.6,
    lineHeight: 1.05,
  },
  commandValueSmall: {
    fontSize: 15,
    fontWeight: 850,
    color: "#172033",
    lineHeight: 1.35,
  },
  commandText: {
    color: "#667085",
    fontSize: 11.5,
    fontWeight: 600,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 10,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid #e7edf5",
    borderRadius: 15,
    padding: 13,
    minHeight: 96,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  },
  metricTop: {
    display: "flex",
    gap: 7,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  metricLabel: {
    fontSize: 11.5,
    color: "#475467",
    fontWeight: 800,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 850,
    letterSpacing: -0.75,
    color: "#111827",
  },
  metricText: {
    margin: "3px 0 0",
    color: "#667085",
    fontSize: 11.25,
    lineHeight: 1.35,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 12,
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e7edf5",
    borderRadius: 16,
    padding: 0,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "13px 14px",
    cursor: "pointer",
    listStyle: "none",
  },
  panelTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 850,
    color: "#111827",
  },
  count: {
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 850,
  },
  list: {
    display: "grid",
    gap: 8,
    padding: "0 12px 12px",
  },
  item: {
    background: "#fbfcfd",
    border: "1px solid #eef1f5",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },
  itemTitle: {
    display: "block",
    color: "#111827",
    fontSize: 12.5,
    lineHeight: 1.35,
  },
  itemText: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: 11.5,
    lineHeight: 1.35,
  },
  itemDate: {
    margin: "5px 0 0",
    color: "#98a2b3",
    fontSize: 10.5,
    fontWeight: 700,
  },
  status: {
    alignSelf: "flex-start",
    background: "#ffffff",
    border: "1px solid #e6eaf0",
    color: "#475467",
    borderRadius: 999,
    padding: "4px 7px",
    fontSize: 10.5,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  empty: {
    background: "#fbfcfd",
    border: "1px dashed #d7dde7",
    borderRadius: 12,
    padding: 12,
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
  },
  warning: {
    background: "#fff8eb",
    border: "1px solid #fedf89",
    color: "#92400e",
    borderRadius: 12,
    padding: "9px 11px",
    fontSize: 12,
    fontWeight: 650,
  },
  notice: {
    background: "#ffffff",
    border: "1px solid #e6eaf0",
    borderRadius: 16,
    padding: 18,
    color: "#475467",
  },
  noticeTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 20,
  },
};
