"use client";

import { useEffect, useState } from "react";

type BillingStatus = {
  success: boolean;
  allowed: boolean;
  reason?: string | null;
  firmId?: string | null;
  billingStatus?: string | null;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
};

type Plan = {
  slug: string;
  name: string;
  description: string;
  stripePriceId: string | null;
  monthlyPriceGbp: number | null;
  clientLimit: number;
  staffLimit: number;
  monthlySubmissionLimit: number;
  storageMbLimit: number;
  features: Record<string, boolean>;
};

function getStoredFirmId() {
  if (typeof window === "undefined") return null;

  return (
    window.localStorage.getItem("impersonate_firm_id") ||
    window.localStorage.getItem("active_firm_id") ||
    null
  );
}

function getSupabaseAccessToken() {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || "";

    if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "{}");
      const token = value?.access_token || value?.currentSession?.access_token;

      if (token) return String(token);
    } catch {
      continue;
    }
  }

  return null;
}

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";

        const [statusResponse, plansResponse] = await Promise.all([
          authorisedFetch(`/api/billing/access-status${query}`, {
            cache: "no-store",
          }),
          fetch("/api/billing/plans", {
            cache: "no-store",
          }),
        ]);

        const statusData = await statusResponse.json();
        const plansData = await plansResponse.json();

        setStatus(statusData);
        setPlans(plansData?.plans || []);
      } catch {
        setMessage("Unable to load billing information.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function startCheckout(planSlug: string) {
    const firmId = status?.firmId || getStoredFirmId();

    if (!firmId) {
      setMessage("No firm found. Please log in again.");
      return;
    }

    setActionLoading(planSlug);
    setMessage(null);

    try {
      const response = await authorisedFetch("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          firmId,
          planSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }

      window.location.href = data.url;
    } catch (error: any) {
      setMessage(error?.message || "Unable to start checkout.");
    } finally {
      setActionLoading(null);
    }
  }

  async function openBillingPortal() {
    const firmId = status?.firmId || getStoredFirmId();

    if (!firmId) {
      setMessage("No firm found for billing.");
      return;
    }

    setActionLoading("portal");
    setMessage(null);

    try {
      const response = await authorisedFetch("/api/billing/create-portal-session", {
        method: "POST",
        body: JSON.stringify({ firmId }),
      });

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to open billing portal");
      }

      window.location.href = data.url;
    } catch (error: any) {
      setMessage(error?.message || "Unable to open billing portal.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 28,
          background: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Hala Digital Billing</h1>

        <p style={{ color: "#4b5563", marginBottom: 24 }}>
          Accounting firms need an active Hala Digital subscription to access
          clients, HMRC workflows, MTD submissions and practice tools.
        </p>

        {loading ? (
          <p>Loading billing status...</p>
        ) : (
          <>
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: status?.allowed ? "#ecfdf5" : "#fef2f2",
                border: status?.allowed
                  ? "1px solid #a7f3d0"
                  : "1px solid #fecaca",
                marginBottom: 18,
              }}
            >
              <strong>Status: </strong>
              {status?.allowed ? "Access active" : "Access denied"}
              <br />
              <strong>Billing status: </strong>
              {status?.billingStatus || "none"}
              <br />
              {!status?.allowed && (
                <>
                  <strong>Reason: </strong>
                  {status?.reason || "billing_required"}
                </>
              )}
            </div>

            {status?.allowed ? (
              <button
                onClick={openBillingPortal}
                disabled={actionLoading === "portal"}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111827",
                  color: "white",
                  fontWeight: 700,
                }}
              >
                {actionLoading === "portal" ? "Opening..." : "Manage billing"}
              </button>
            ) : (
              <p style={{ color: "#991b1b" }}>
                Select a plan below to activate access.
              </p>
            )}

            {message && (
              <p style={{ color: "#b91c1c", marginTop: 16 }}>{message}</p>
            )}
          </>
        )}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.slug}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 22,
              background: "white",
              boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
            }}
          >
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>{plan.name}</h2>

            <p style={{ color: "#4b5563", minHeight: 42 }}>
              {plan.description || "Firm-level Hala Digital access"}
            </p>

            <div style={{ fontSize: 28, fontWeight: 800, margin: "14px 0" }}>
              {plan.monthlyPriceGbp
                ? `GBP ${plan.monthlyPriceGbp}/mo`
                : "Custom"}
            </div>

            <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              <li>{plan.clientLimit} clients</li>
              <li>{plan.staffLimit} staff users</li>
              <li>{plan.monthlySubmissionLimit} monthly submissions</li>
              <li>{plan.storageMbLimit} MB storage</li>
            </ul>

            <button
              onClick={() => startCheckout(plan.slug)}
              disabled={!plan.stripePriceId || actionLoading === plan.slug}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: plan.stripePriceId ? "#111827" : "#9ca3af",
                color: "white",
                fontWeight: 700,
                marginTop: 14,
                cursor: plan.stripePriceId ? "pointer" : "not-allowed",
              }}
            >
              {actionLoading === plan.slug
                ? "Starting..."
                : plan.stripePriceId
                  ? "Activate plan"
                  : "Stripe price missing"}
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

