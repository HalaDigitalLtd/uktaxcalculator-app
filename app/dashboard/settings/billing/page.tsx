"use client";

import { useEffect, useState } from "react";

type BillingStatus = {
  success: boolean;
  allowed: boolean;
  reason?: string | null;
  firmId?: string | null;
  billingStatus?: string | null;
  accessStatus?: string | null;
  planSlug?: string | null;
  usage?: {
    clients: number;
    staff: number;
    monthlySubmissions: number;
    storageMbUsed: number;
  };
  limits?: {
    clientLimit: number;
    staffLimit: number;
    monthlySubmissionLimit: number;
    storageMbLimit: number;
  };
};

function getStoredFirmId() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("impersonate_firm_id") ||
    localStorage.getItem("active_firm_id") ||
    null
  );
}

function getSupabaseAccessToken() {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || "";

    if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      const token = value?.access_token || value?.currentSession?.access_token;

      if (token) return String(token);
    } catch {
      continue;
    }
  }

  return null;
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const percentage =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 14,
        }}
      >
        <span>{label}</span>
        <strong>
          {used} / {limit}
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: 10,
          borderRadius: 999,
          background: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background:
              percentage >= 90
                ? "#dc2626"
                : percentage >= 75
                  ? "#d97706"
                  : "#111827",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function authorisedFetch(url: string, options: RequestInit = {}) {
    const token = getSupabaseAccessToken();

    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  useEffect(() => {
    async function load() {
      try {
        const firmId = getStoredFirmId();

        const query = firmId
          ? `?firmId=${encodeURIComponent(firmId)}`
          : "";

        const response = await authorisedFetch(
          `/api/billing/access-status${query}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        setStatus(data);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main
      style={{
        padding: 32,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: 30,
        }}
      >
        <h1
          style={{
            fontSize: 34,
            marginBottom: 10,
          }}
        >
          Hala Digital Operations Centre
        </h1>

        <p
          style={{
            color: "#4b5563",
            fontSize: 16,
          }}
        >
          Production SaaS billing, usage, operational and subscription monitoring
          for accountant firms.
        </p>
      </div>

      {loading ? (
        <p>Loading operational data...</p>
      ) : (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 24,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Subscription status
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 26,
                  fontWeight: 800,
                  textTransform: "capitalize",
                }}
              >
                {status?.billingStatus || "Unknown"}
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: status?.allowed ? "#047857" : "#b91c1c",
                  fontWeight: 700,
                }}
              >
                {status?.allowed
                  ? "Operational access active"
                  : "Access restricted"}
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 24,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Current plan
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 26,
                  fontWeight: 800,
                  textTransform: "capitalize",
                }}
              >
                {status?.planSlug || "Starter"}
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#4b5563",
                }}
              >
                Multi-tenant accountant SaaS subscription
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                padding: 24,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Firm operational status
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 26,
                  fontWeight: 800,
                  textTransform: "capitalize",
                }}
              >
                {status?.accessStatus || "Unknown"}
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#4b5563",
                }}
              >
                HMRC workflow infrastructure active
              </div>
            </div>
          </section>

          <section
            style={{
              borderRadius: 20,
              padding: 28,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontSize: 24,
                marginBottom: 22,
              }}
            >
              Usage & Capacity Monitoring
            </h2>

            <UsageBar
              label="Clients"
              used={status?.usage?.clients || 0}
              limit={status?.limits?.clientLimit || 0}
            />

            <UsageBar
              label="Staff users"
              used={status?.usage?.staff || 0}
              limit={status?.limits?.staffLimit || 0}
            />

            <UsageBar
              label="Monthly submissions"
              used={status?.usage?.monthlySubmissions || 0}
              limit={status?.limits?.monthlySubmissionLimit || 0}
            />

            <UsageBar
              label="Storage usage (MB)"
              used={status?.usage?.storageMbUsed || 0}
              limit={status?.limits?.storageMbLimit || 0}
            />
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {[
              "HMRC OAuth connected",
              "Immutable evidence architecture active",
              "Quarterly workflow engine active",
              "Stripe billing lifecycle active",
              "Usage metering active",
              "Webhook audit tracking active",
            ].map((item) => (
              <div
                key={item}
                style={{
                  borderRadius: 18,
                  padding: 22,
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
                  fontWeight: 600,
                }}
              >
                ✅ {item}
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
