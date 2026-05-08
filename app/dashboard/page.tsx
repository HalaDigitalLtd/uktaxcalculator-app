"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [firmId, setFirmId] = useState<string | null>(null);
  const [isHalaAdmin, setIsHalaAdmin] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/auth/login");
        return;
      }

      setUserEmail(userData.user.email || "");

      const { data: adminCheck } = await supabase.rpc("is_hala_admin");
      const adminStatus = Boolean(adminCheck);
      setIsHalaAdmin(adminStatus);

      const impersonatedFirmId = localStorage.getItem("impersonate_firm_id");

      const { data: resolvedFirmId } = await supabase.rpc(
        "get_current_active_firm_id",
        {
          impersonated_firm_id: impersonatedFirmId || null,
        }
      );

      setFirmId(resolvedFirmId || null);

      if (resolvedFirmId) {
        router.replace("/dashboard/clients");
        return;
      }

      setLoading(false);
    };

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1 style={headingStyle}>Loading dashboard...</h1>
          <p style={subtitleStyle}>Checking secure firm access.</p>
        </div>
      </main>
    );
  }

  if (isHalaAdmin && !firmId) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1 style={headingStyle}>Hala Super Admin</h1>
          <p style={subtitleStyle}>
            You are logged in as {userEmail}. Select a firm before opening a firm workspace.
          </p>

          <Link href="/admin/firms" style={primaryButtonStyle}>
            Open Firms Control Centre
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={headingStyle}>Firm access required</h1>

        <p style={subtitleStyle}>
          Your login is valid, but your account is not linked to an active firm workspace.
        </p>

        <div style={actionsStyle}>
          <Link href="/auth/register" style={primaryButtonStyle}>
            Register Firm
          </Link>

          <Link href="/auth/login" style={secondaryButtonStyle}>
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f8fb",
  padding: "40px",
  fontFamily: "Inter, Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "960px",
  margin: "0 auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "34px",
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const headingStyle: React.CSSProperties = {
  fontSize: "40px",
  fontWeight: 900,
  marginBottom: "10px",
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "17px",
  marginBottom: "28px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#111827",
  color: "white",
  padding: "13px 20px",
  borderRadius: "12px",
  textDecoration: "none",
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  background: "white",
  color: "#111827",
  padding: "13px 20px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  textDecoration: "none",
  fontWeight: 800,
};