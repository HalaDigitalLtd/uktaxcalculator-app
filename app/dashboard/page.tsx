"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { authenticatedFetch } from "../../lib/authenticatedFetch";

type Tone = "green" | "amber" | "red" | "blue" | "slate";

type Metric = {
  label: string;
  value: number | string;
  tone: Tone;
  helper: string;
};

type QueueItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  href?: string | null;
  createdAt?: string | null;
};

type OperationalDashboard = {
  success: boolean;
  generatedAt: string;
  firmId: string;
  metrics: Metric[];
  queues: {
    failedSubmissions: QueueItem[];
    partnerApprovals: QueueItem[];
    overdueObligations: QueueItem[];
    hmrcSyncWarnings: QueueItem[];
    auditAlerts: QueueItem[];
  };
  activity: QueueItem[];
  warnings: string[];
};

function getToneStyle(tone: Tone): React.CSSProperties {
  if (tone === "green") {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (tone === "amber") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  if (tone === "red") {
    return {
      background: "#fef2f2",
      color: "#b91c1c",
      borderColor: "#fecaca",
    };
  }

  if (tone === "blue") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  return {
    background: "#f8fafc",
    color: "#334155",
    borderColor: "#e2e8f0",
  };
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStoredFirmId() {
  if (typeof window === "undefined") return null;

  return (
    window.localStorage.getItem("impersonate_firm_id") ||
    window.localStorage.getItem("active_firm_id") ||
    null
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: 18,
        border: "1px dashed #cbd5e1",
        borderRadius: 16,
        color: "#64748b",
        background: "#f8fafc",
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function QueueCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: QueueItem[];
  emptyLabel: string;
}) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <h2 style={panelTitleStyle}>{title}</h2>
        <span style={countPillStyle}>{items.length}</span>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.length === 0 ? (
          <EmptyState label={emptyLabel} />
        ) : (
          items.map((item) => {
            const content = (
              <div style={queueItemStyle}>
                <div>
                  <strong style={{ color: "#0f172a" }}>{item.title}</strong>
                  <p style={queueDescriptionStyle}>{item.description}</p>
                  <p style={queueDateStyle}>{formatDate(item.createdAt)}</p>
                </div>

                <span style={statusPillStyle}>{item.status}</span>
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} style={{ textDecoration: "none" }}>
                  {content}
                </Link>
              );
            }

            return <div key={item.id}>{content}</div>;
          })
        )}
      </div>
    </section>
  );
}

export default function DashboardHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [isHalaAdmin, setIsHalaAdmin] = useState(false);
  const [dashboard, setDashboard] = useState<OperationalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allWarnings = useMemo(() => dashboard?.warnings || [], [dashboard]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
          router.replace("/auth/login");
          return;
        }

        setUserEmail(userData.user.email || "");

        const { data: adminCheck } = await supabase.rpc("is_hala_admin");
        const adminStatus = Boolean(adminCheck);

        if (!cancelled) {
          setIsHalaAdmin(adminStatus);
        }

        const storedFirmId = getStoredFirmId();

        const { data: resolvedFirmId, error: firmError } = await supabase.rpc(
          "get_current_active_firm_id",
          {
            impersonated_firm_id: storedFirmId || null,
          }
        );

        if (firmError) {
          throw new Error(firmError.message || "Unable to resolve active firm.");
        }

        if (!resolvedFirmId) {
          if (!cancelled) {
            setFirmId(null);
            setDashboard(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setFirmId(resolvedFirmId);
        }

        const response = await authenticatedFetch(
          `/api/dashboard/operational?firmId=${encodeURIComponent(resolvedFirmId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Unable to load operational dashboard.");
        }

        if (!cancelled) {
          setDashboard(payload);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Dashboard failed to load.");
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div style={pageShellStyle}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Operational dashboard</p>
          <h1 style={heroTitleStyle}>Loading accountant practice intelligence...</h1>
          <p style={heroSubtitleStyle}>
            Reading firm access, billing gate and HMRC workflow signals.
          </p>
        </section>
      </div>
    );
  }

  if (isHalaAdmin && !firmId) {
    return (
      <div style={pageShellStyle}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Hala Super Admin</p>
          <h1 style={heroTitleStyle}>Select a firm workspace</h1>
          <p style={heroSubtitleStyle}>
            You are logged in as {userEmail}. Choose a firm before opening operational dashboards.
          </p>

          <Link href="/admin/firms" style={primaryButtonStyle}>
            Open Firms Control Centre
          </Link>
        </section>
      </div>
    );
  }

  if (!firmId) {
    return (
      <div style={pageShellStyle}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Firm access required</p>
          <h1 style={heroTitleStyle}>No active firm workspace found</h1>
          <p style={heroSubtitleStyle}>
            Your login is valid, but your account is not linked to an active firm workspace.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/auth/register" style={primaryButtonStyle}>
              Register Firm
            </Link>

            <Link href="/auth/login" style={secondaryButtonStyle}>
              Back to Login
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageShellStyle}>
        <section style={heroStyle}>
          <p style={eyebrowStyle}>Operational dashboard</p>
          <h1 style={heroTitleStyle}>Dashboard needs attention</h1>
          <p style={heroSubtitleStyle}>{error}</p>

          <Link href="/dashboard/clients" style={primaryButtonStyle}>
            Open Clients
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div style={pageShellStyle}>
      <section style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Practice operations</p>
          <h1 style={heroTitleStyle}>Operational Dashboard Engine</h1>
          <p style={heroSubtitleStyle}>
            Read-only intelligence across HMRC obligations, submissions, approvals, immutable evidence and client workflow risk.
          </p>
        </div>

        <div style={heroActionsStyle}>
          <Link href="/dashboard/clients" style={primaryButtonStyle}>
            Open Clients
          </Link>

          <Link href="/dashboard/hmrc-connect" style={secondaryButtonStyle}>
            HMRC Connections
          </Link>
        </div>
      </section>

      <section style={metricsGridStyle}>
        {(dashboard?.metrics || []).map((metric) => (
          <div key={metric.label} style={metricCardStyle}>
            <div
              style={{
                ...metricBadgeStyle,
                ...getToneStyle(metric.tone),
              }}
            >
              {metric.label}
            </div>

            <strong style={metricValueStyle}>{metric.value}</strong>
            <p style={metricHelperStyle}>{metric.helper}</p>
          </div>
        ))}
      </section>

      {allWarnings.length > 0 && (
        <section style={warningPanelStyle}>
          <h2 style={panelTitleStyle}>Schema / data warnings</h2>
          <p style={heroSubtitleStyle}>
            The dashboard stayed online, but some read-only checks could not be completed.
          </p>

          <ul style={{ margin: 0, paddingLeft: 20, color: "#92400e", lineHeight: 1.8 }}>
            {allWarnings.slice(0, 8).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={queueGridStyle}>
        <QueueCard
          title="Overdue obligations"
          items={dashboard?.queues.overdueObligations || []}
          emptyLabel="No overdue HMRC obligations detected."
        />

        <QueueCard
          title="Failed submissions"
          items={dashboard?.queues.failedSubmissions || []}
          emptyLabel="No failed HMRC submissions detected."
        />

        <QueueCard
          title="Partner approval queue"
          items={dashboard?.queues.partnerApprovals || []}
          emptyLabel="No partner approval items pending."
        />

        <QueueCard
          title="HMRC sync warnings"
          items={dashboard?.queues.hmrcSyncWarnings || []}
          emptyLabel="No HMRC sync warnings detected."
        />

        <QueueCard
          title="Audit alerts"
          items={dashboard?.queues.auditAlerts || []}
          emptyLabel="No audit integrity alerts detected."
        />

        <QueueCard
          title="Recent activity"
          items={dashboard?.activity || []}
          emptyLabel="No recent HMRC activity found."
        />
      </section>

      <section style={footerNoteStyle}>
        <strong>Read-only control layer:</strong> this dashboard does not mutate HMRC submissions, OAuth tokens,
        Stripe billing, amendment records, evidence snapshots, cumulative calculations or workflow statuses.
      </section>
    </div>
  );
}

const pageShellStyle: React.CSSProperties = {
  display: "grid",
  gap: 22,
};

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #075985 100%)",
  color: "white",
  borderRadius: 26,
  padding: 30,
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  boxShadow: "0 22px 45px rgba(15, 23, 42, 0.22)",
};

const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 10px",
  color: "#67e8f9",
  textTransform: "uppercase",
  letterSpacing: 1.6,
  fontSize: 12,
  fontWeight: 900,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.1,
  fontWeight: 950,
};

const heroSubtitleStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  lineHeight: 1.7,
  maxWidth: 860,
  fontSize: 15,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#67e8f9",
  color: "#083344",
  padding: "12px 16px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 900,
  border: "1px solid rgba(255,255,255,0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "white",
  color: "#0f172a",
  padding: "12px 16px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 900,
  border: "1px solid #e2e8f0",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
};

const metricCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const metricBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const metricValueStyle: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  fontSize: 34,
  color: "#0f172a",
};

const metricHelperStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  lineHeight: 1.6,
  fontSize: 14,
};

const queueGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 18,
};

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 16,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#0f172a",
  fontWeight: 900,
};

const countPillStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 999,
  padding: "7px 11px",
  fontWeight: 900,
  fontSize: 12,
};

const queueItemStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  background: "#ffffff",
};

const queueDescriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  lineHeight: 1.55,
  fontSize: 14,
};

const queueDateStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 700,
};

const statusPillStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  background: "#f8fafc",
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const warningPanelStyle: React.CSSProperties = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: 22,
  padding: 20,
};

const footerNoteStyle: React.CSSProperties = {
  background: "#ecfeff",
  border: "1px solid #a5f3fc",
  color: "#155e75",
  borderRadius: 18,
  padding: 18,
  lineHeight: 1.7,
};
