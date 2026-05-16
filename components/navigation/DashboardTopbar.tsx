"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardTopbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("active_firm_id");
    localStorage.removeItem("impersonate_firm_id");
    router.replace("/auth/login");
  };

  return (
    <header style={{
      height: 64,
      background: "rgba(255,255,255,.94)",
      backdropFilter: "blur(18px)",
      borderBottom: "1px solid #edf0f5",
      padding: "0 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div>
        <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 850, letterSpacing: 1.1, textTransform: "uppercase" }}>
          Accountant workspace
        </p>

        <h1 style={{ margin: "2px 0 0", color: "#111827", fontSize: 20, fontWeight: 900 }}>
          Hala Digital
        </h1>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={statusGreen}>Billing active</span>
        <span style={statusBlue}>HMRC sandbox</span>

        <Link href="/dashboard/settings/billing" style={topLink}>
          Billing
        </Link>

        <Link href="/dashboard/settings" style={topLink}>
          Settings
        </Link>

        <button onClick={handleLogout} style={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}

const statusGreen: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  fontSize: 11,
  fontWeight: 800,
};

const statusBlue: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eff8ff",
  color: "#175cd3",
  border: "1px solid #b2ddff",
  fontSize: 11,
  fontWeight: 800,
};

const topLink: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid #e4e7ec",
  background: "#fff",
  color: "#172033",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const logout: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fffafa",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};
