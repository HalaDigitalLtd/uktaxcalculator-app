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

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const firmId =
          window.localStorage.getItem("impersonate_firm_id") ||
          window.localStorage.getItem("active_firm_id") ||
          null;

        const query = firmId ? `?firmId=${encodeURIComponent(firmId)}` : "";
        const response = await fetch(`/api/billing/access-status${query}`, {
          cache: "no-store",
        });

        const data = await response.json();
        setStatus(data);
      } catch {
        setMessage("Unable to check billing status.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function openBillingPortal() {
    if (!status?.firmId) {
      setMessage("No firm found for billing.");
      return;
    }

    setPortalLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firmId: status.firmId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to open billing portal");
      }

      window.location.href = data.url;
    } catch (error: any) {
      setMessage(error?.message || "Unable to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 28,
          background: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          Hala Digital Billing
        </h1>

        <p style={{ color: "#4b5563", marginBottom: 24 }}>
          Your firm must have an active Hala Digital subscription to access the
          software, clients, HMRC workflows and practice tools.
        </p>

        {loading ? (
          <p>Checking billing status...</p>
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
                marginBottom: 20,
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

            {!status?.allowed && (
              <p style={{ color: "#991b1b", marginBottom: 20 }}>
                Access to the Hala Digital software is currently locked because
                your firm does not have an active subscription. Please complete
                or restore billing to continue.
              </p>
            )}

            <button
              onClick={openBillingPortal}
              disabled={portalLoading || !status?.firmId}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "white",
                fontWeight: 700,
                cursor: portalLoading ? "not-allowed" : "pointer",
              }}
            >
              {portalLoading ? "Opening..." : "Manage billing"}
            </button>

            {message && (
              <p style={{ color: "#b91c1c", marginTop: 16 }}>{message}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
