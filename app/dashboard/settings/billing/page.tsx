"use client";

import { useEffect, useMemo, useState } from "react";

type BillingStatus = {
  success: boolean;
  allowed: boolean;
  reason?: string | null;
  firmId?: string | null;
  billingStatus?: string | null;
  accessStatus?: string | null;
  planSlug?: string | null;
  gracePeriodEndsAt?: string | null;
  usage?: {
    clients: number;
    staff: number;
    monthlySubmissions: number;
  };
  limits?: {
    clientLimit: number;
    staffLimit: number;
    monthlySubmissionLimit: number;
    storageMbLimit: number;
  };
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

const PLAN_RANK: Record<string, number> = {
  starter: 1,
  practice: 2,
  scale: 3,
  enterprise: 4,
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

function money(plan: Plan) {
  if (plan.slug === "enterprise") return "Custom";
  if (!plan.monthlyPriceGbp) return "Custom";
  return `£${plan.monthlyPriceGbp}/mo`;
}

function limitText(plan: Plan, key: "clients" | "staff" | "submissions" | "storage") {
  if (plan.slug === "enterprise") {
    if (key === "clients") return "Unlimited clients";
    if (key === "staff") return "Unlimited staff users";
    if (key === "submissions") return "Unlimited submissions";
    return "Custom storage";
  }

  if (key === "clients") return `${plan.clientLimit} clients`;
  if (key === "staff") return `${plan.staffLimit} staff users`;
  if (key === "submissions") return `${plan.monthlySubmissionLimit} monthly submissions`;
  return `${plan.storageMbLimit} MB storage`;
}

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentPlanSlug = useMemo(
    () => String(status?.planSlug || "").toLowerCase(),
    [status?.planSlug]
  );

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

  async function reconcileSubscription(firmId: string) {
    try {
      await authorisedFetch("/api/billing/reconcile-subscription", {
        method: "POST",
        body: JSON.stringify({ firmId }),
      });
    } catch {}
  }

  async function loadBilling() {
    try {
      const firmId = getStoredFirmId();
      const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";

      const [statusResponse, plansResponse] = await Promise.all([
        authorisedFetch(`/api/billing/access-status${query}`, { cache: "no-store" }),
        fetch("/api/billing/plans", { cache: "no-store" }),
      ]);

      let statusData = await statusResponse.json();
      const plansData = await plansResponse.json();

      if (!statusData?.allowed && statusData?.firmId) {
        await reconcileSubscription(statusData.firmId);

        const refreshed = await authorisedFetch(`/api/billing/access-status${query}`, {
          cache: "no-store",
        });

        statusData = await refreshed.json();
      }

      setStatus(statusData);
      setPlans(plansData?.plans || []);
    } catch {
      setMessage("Unable to load billing information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
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
        body: JSON.stringify({ firmId, planSlug }),
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

  async function openBillingPortal(action: string = "portal") {
    const firmId = status?.firmId || getStoredFirmId();

    if (!firmId) {
      setMessage("No firm found for billing.");
      return;
    }

    setActionLoading(action);
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

  function contactSales() {
    const subject = encodeURIComponent("Hala Digital Enterprise Plan");
    const body = encodeURIComponent(
      `Hi Hala Digital,\n\nI would like to discuss the Enterprise plan for my firm.\n\nFirm ID: ${status?.firmId || ""}\nCurrent plan: ${currentPlanSlug || "none"}\n\nThanks.`
    );

    window.location.href = `mailto:info@haladigital.co.uk?subject=${subject}&body=${body}`;
  }

  function buttonForPlan(plan: Plan) {
    const isCurrent = currentPlanSlug === plan.slug && status?.allowed;
    const hasActiveSubscription = Boolean(status?.allowed && currentPlanSlug);
    const isEnterprise = plan.slug === "enterprise";

    if (isCurrent) {
      return {
        label: "Current plan",
        disabled: true,
        onClick: () => {},
        loadingKey: plan.slug,
      };
    }

    if (isEnterprise) {
      return {
        label: "Contact sales",
        disabled: false,
        onClick: contactSales,
        loadingKey: "enterprise-sales",
      };
    }

    if (hasActiveSubscription) {
      const direction =
        PLAN_RANK[plan.slug] > PLAN_RANK[currentPlanSlug] ? "Upgrade plan" : "Change plan";

      return {
        label: direction,
        disabled: false,
        onClick: () => openBillingPortal(`change-${plan.slug}`),
        loadingKey: `change-${plan.slug}`,
      };
    }

    return {
      label: plan.stripePriceId ? "Activate plan" : "Stripe price missing",
      disabled: !plan.stripePriceId,
      onClick: () => startCheckout(plan.slug),
      loadingKey: plan.slug,
    };
  }

  return (
    <main style={{ padding: 32, maxWidth: 1180, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 28,
          background: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Hala Digital Billing</h1>

        <p style={{ color: "#4b5563", marginBottom: 24 }}>
          Firm-level SaaS subscription control for MTD ITSA workflows, client access,
          HMRC submissions, evidence vault and practice operations.
        </p>

        {loading ? (
          <p>Loading billing status...</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: status?.allowed ? "#ecfdf5" : "#fef2f2",
                  border: status?.allowed ? "1px solid #a7f3d0" : "1px solid #fecaca",
                }}
              >
                <strong>Status</strong>
                <div>{status?.allowed ? "Access active" : "Access restricted"}</div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <strong>Billing status</strong>
                <div>{status?.billingStatus || "none"}</div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <strong>Current plan</strong>
                <div style={{ textTransform: "capitalize" }}>
                  {currentPlanSlug || "No active plan"}
                </div>
              </div>
            </div>

            {!status?.allowed && (
              <p style={{ color: "#991b1b", marginBottom: 12 }}>
                Reason: {status?.reason || "billing_required"}
              </p>
            )}

            {status?.allowed && (
              <button
                onClick={() => openBillingPortal("portal")}
                disabled={actionLoading === "portal"}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111827",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {actionLoading === "portal" ? "Opening..." : "Manage billing"}
              </button>
            )}

            {message && <p style={{ color: "#b91c1c", marginTop: 16 }}>{message}</p>}
          </>
        )}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 18,
        }}
      >
        {plans.map((plan) => {
          const button = buttonForPlan(plan);
          const isCurrent = currentPlanSlug === plan.slug && status?.allowed;

          return (
            <div
              key={plan.slug}
              style={{
                position: "relative",
                border: isCurrent ? "2px solid #111827" : "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 22,
                background: isCurrent ? "#f8fafc" : "white",
                boxShadow: isCurrent
                  ? "0 14px 32px rgba(17,24,39,0.12)"
                  : "0 8px 24px rgba(0,0,0,0.05)",
              }}
            >
              {isCurrent && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    padding: "5px 10px",
                    borderRadius: 999,
                    background: "#111827",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ACTIVE
                </div>
              )}

              <h2 style={{ fontSize: 22, marginBottom: 6 }}>{plan.name}</h2>

              <p style={{ color: "#4b5563", minHeight: 44 }}>
                {plan.description || "Firm-level Hala Digital access"}
              </p>

              <div style={{ fontSize: 30, fontWeight: 900, margin: "14px 0" }}>
                {money(plan)}
              </div>

              <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                <li>{limitText(plan, "clients")}</li>
                <li>{limitText(plan, "staff")}</li>
                <li>{limitText(plan, "submissions")}</li>
                <li>{limitText(plan, "storage")}</li>
              </ul>

              <button
                onClick={button.onClick}
                disabled={button.disabled || actionLoading === button.loadingKey}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: isCurrent ? "1px solid #111827" : "none",
                  background: isCurrent
                    ? "#e5e7eb"
                    : button.disabled
                      ? "#9ca3af"
                      : plan.slug === "enterprise"
                        ? "#065f46"
                        : "#111827",
                  color: isCurrent ? "#111827" : "white",
                  fontWeight: 800,
                  marginTop: 14,
                  cursor: button.disabled ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === button.loadingKey ? "Opening..." : button.label}
              </button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
