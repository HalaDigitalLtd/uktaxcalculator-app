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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/auth/login");
        return;
      }

      const email = userData.user.email || "";
      setUserEmail(email);

      const { data: adminCheck } = await supabase.rpc("is_hala_admin");
      const adminStatus = Boolean(adminCheck);
      setIsAdmin(adminStatus);

      const impersonatedFirmId =
        typeof window !== "undefined"
          ? localStorage.getItem("impersonate_firm_id")
          : null;

      const { data: resolvedFirmId, error: firmError } = await supabase.rpc(
        "get_current_active_firm_id",
        {
          impersonated_firm_id: impersonatedFirmId || null,
        }
      );

      if (firmError) {
        console.error("Firm resolver error:", firmError);
      }

      setFirmId(resolvedFirmId || null);

      if (adminStatus && !impersonatedFirmId && !resolvedFirmId) {
        setLoading(false);
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

  if (isAdmin && !firmId) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1 style={headingStyle}>Hala Admin Mode</h1>

          <p style={subtitleStyle}>
            You are logged in as {userEmail}. Select a firm from the admin
            control centre before opening the firm dashboard.
          </p>

          <Link href="/admin/firms" style={primaryButtonStyle}>
            Open Admin Firms
          </Link>
        </div>
      </main>
    );
  }

  if (!firmId) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1 style={headingStyle}>No firm access found</h1>

          <p style={subtitleStyle}>
            Your login is valid, but your account is not currently linked to an
            active firm.
          </p>

          <Link href="/auth/login" style={primaryButtonStyle}>
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={headingStyle}>Hala Digital MTD Dashboard</h1>

        <p style={subtitleStyle}>Main control centre for MTD ITSA workflow.</p>

        {isAdmin && (
          <div style={adminBannerStyle}>
            Admin firm view active. You are viewing this dashboard through firm
            impersonation.
          </div>
        )}

        <div style={gridStyle}>
          <Link href="/dashboard/clients" style={cardStyle}>
            <h2 style={titleStyle}>Clients</h2>
            <p style={textStyle}>
              Open clients, tax years, quarters and submissions.
            </p>
          </Link>

          <Link href="/dashboard/hmrc-connect" style={cardStyle}>
            <h2 style={titleStyle}>HMRC Connect</h2>
            <p style={textStyle}>Manage HMRC OAuth connections and tokens.</p>
          </Link>

          <Link href="/dashboard/settings" style={cardStyle}>
            <h2 style={titleStyle}>Settings</h2>
            <p style={textStyle}>Firm settings and internal configuration.</p>
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
  maxWidth: "1100px",
  margin: "0 auto",
};

const headingStyle: React.CSSProperties = {
  fontSize: "42px",
  fontWeight: 900,
  marginBottom: "10px",
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "18px",
  marginBottom: "40px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "20px",
  padding: "28px",
  textDecoration: "none",
  color: "#111827",
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 900,
  marginBottom: "10px",
};

const textStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "15px",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#111827",
  color: "white",
  padding: "14px 22px",
  borderRadius: "14px",
  textDecoration: "none",
  fontWeight: 800,
};

const adminBannerStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  padding: "14px 18px",
  borderRadius: "14px",
  marginBottom: "24px",
  fontWeight: 700,
}