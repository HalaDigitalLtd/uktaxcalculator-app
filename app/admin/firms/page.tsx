"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function AdminFirmsPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [firms, setFirms] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/auth/login");
      return;
    }

    const email = userData.user.email || "";
    setUserEmail(email);

    const { data: adminOk, error: adminError } = await supabase.rpc(
      "is_hala_admin"
    );

    if (adminError || !adminOk) {
      setIsAdmin(false);
      setLoading(false);
      router.replace("/dashboard");
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase.rpc("get_admin_firms_overview");

    if (error) {
      setMessage(error.message);
      setFirms([]);
      setLoading(false);
      return;
    }

    const mappedFirms = (data || []).map((firm: any) => ({
      id: firm.firm_id,
      name: firm.firm_name || "No firm name",
      slug: firm.firm_slug || "",
      created_at: firm.created_at,
      users_count: Number(firm.firm_users_count || 0),
      active_users_count: Number(firm.active_firm_users_count || 0),
      clients_count: Number(firm.clients_count || 0),
      hmrc_connected_count: Number(firm.connected_clients_count || 0),
    }));

    setFirms(mappedFirms);
    setLoading(false);
  };

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      totalFirms: firms.length,
      totalUsers: firms.reduce(
        (sum, firm) => sum + Number(firm.users_count || 0),
        0
      ),
      totalClients: firms.reduce(
        (sum, firm) => sum + Number(firm.clients_count || 0),
        0
      ),
      hmrcConnectedClients: firms.reduce(
        (sum, firm) => sum + Number(firm.hmrc_connected_count || 0),
        0
      ),
    };
  }, [firms]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("impersonate_firm_id");
    }

    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  const openFirmDashboard = (firmId: string) => {
    localStorage.setItem("impersonate_firm_id", firmId);
    router.push("/dashboard");
  };

  const clearImpersonation = () => {
    localStorage.removeItem("impersonate_firm_id");
    setMessage("Firm impersonation cleared.");
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading Hala admin panel...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Redirecting...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <p style={styles.kicker}>Hala Digital Admin</p>
          <h1 style={styles.headerTitle}>Firms Control Centre</h1>
          <p style={styles.headerText}>
            Manage accounting firms using Hala MTD SaaS. Logged in as{" "}
            <strong>{userEmail}</strong>.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button onClick={clearImpersonation} style={styles.lightButton}>
            Clear Firm View
          </button>

          <button onClick={loadAdminData} style={styles.lightButton}>
            Refresh
          </button>

          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Firms</span>
          <strong style={styles.statValue}>{stats.totalFirms}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Firm users</span>
          <strong style={styles.statValue}>{stats.totalUsers}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Clients</span>
          <strong style={styles.statValue}>{stats.totalClients}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>HMRC connected clients</span>
          <strong style={styles.statValue}>{stats.hmrcConnectedClients}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Registered Firms</h2>

        {firms.length === 0 ? (
          <p style={styles.muted}>No firms registered yet.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Firm</th>
                  <th style={styles.th}>Firm ID</th>
                  <th style={styles.th}>Users</th>
                  <th style={styles.th}>Clients</th>
                  <th style={styles.th}>HMRC Connected</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {firms.map((firm) => (
                  <tr key={firm.id}>
                    <td style={styles.td}>
                      <strong>{firm.name || "No firm name"}</strong>
                    </td>

                    <td style={styles.tdMono}>{firm.id}</td>

                    <td style={styles.td}>{firm.users_count || 0}</td>

                    <td style={styles.td}>{firm.clients_count || 0}</td>

                    <td style={styles.td}>{firm.hmrc_connected_count || 0}</td>

                    <td style={styles.td}>
                      {firm.created_at
                        ? new Date(firm.created_at).toLocaleDateString("en-GB")
                        : "N/A"}
                    </td>

                    <td style={styles.td}>
                      <button
                        onClick={() => openFirmDashboard(firm.id)}
                        style={styles.primaryButton}
                      >
                        Open Firm Dashboard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: "32px",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#111827",
  },
  headerCard: {
    background: "#0f172a",
    color: "white",
    borderRadius: "20px",
    padding: "26px",
    marginBottom: "24px",
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
  },
  kicker: {
    margin: "0 0 6px",
    color: "#93c5fd",
    fontSize: "14px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  headerTitle: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 900,
  },
  headerText: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: "15px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 900,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  statCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "8px",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 900,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
  },
  sectionTitle: {
    margin: "0 0 18px",
    fontSize: "22px",
    fontWeight: 900,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "980px",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    color: "#64748b",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 900,
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "middle",
  },
  tdMono: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    color: "#475569",
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "white",
    padding: "9px 12px",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  lightButton: {
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  logoutButton: {
    border: "none",
    background: "white",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  darkButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  message: {
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    padding: "14px 16px",
    borderRadius: "14px",
    marginBottom: "20px",
    fontWeight: 700,
  },
};