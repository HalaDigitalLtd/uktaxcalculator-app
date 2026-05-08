"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function DashboardClientsPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [firmId, setFirmId] = useState("");
  const [firmName, setFirmName] = useState("Your firm");
  const [clients, setClients] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    setMessage("");

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/auth/login");
      return;
    }

    const email = authData.user.email || "";
    setUserEmail(email);

    const { data: adminOk } = await supabase.rpc("is_hala_admin");
    const adminStatus = Boolean(adminOk);
    setIsAdmin(adminStatus);

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: resolvedFirmId, error: firmResolveError } = await supabase.rpc(
      "get_current_active_firm_id",
      {
        impersonated_firm_id: impersonatedFirmId || null,
      }
    );

    if (firmResolveError || !resolvedFirmId) {
      setMessage(
        adminStatus
          ? "Admin mode active. Please select a firm from the admin control centre first."
          : firmResolveError?.message ||
              "No firm access found for this login. Please check firm user setup."
      );
      setFirmId("");
      setClients([]);
      setLoading(false);
      return;
    }

    setFirmId(resolvedFirmId);

    const { data: firmData, error: firmError } = await supabase
      .from("firms")
      .select("*")
      .eq("id", resolvedFirmId)
      .maybeSingle();

    if (firmError) {
      setMessage(`Firm load error: ${firmError.message}`);
      setClients([]);
      setLoading(false);
      return;
    }

    setFirmName(firmData?.name || "Your firm");

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("firm_id", resolvedFirmId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setClients([]);
      setLoading(false);
      return;
    }

    setClients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      hmrcConnected: clients.filter((c) => Boolean(c.hmrc_connected)).length,
      withNino: clients.filter((c) => Boolean(c.nino)).length,
    };
  }, [clients]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading firm clients...</div>
      </main>
    );
  }

  if (!firmId) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>No firm selected</h1>
          <p style={styles.muted}>{message}</p>

          <div style={{ marginTop: "18px", display: "flex", gap: "12px" }}>
            {isAdmin && (
              <Link href="/admin/firms" style={styles.openButton}>
                Open Admin Firms
              </Link>
            )}

            <Link href="/dashboard" style={styles.secondaryLink}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link href="/dashboard" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <h1 style={styles.title}>MTD Clients</h1>

          <p style={styles.subtitle}>
            Firm: <strong>{firmName}</strong> · Logged in as:{" "}
            <strong>{userEmail || "Unknown user"}</strong>
          </p>

          <p style={styles.subtitle}>
            Firm ID: <strong>{firmId || "Not found"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <Link href="/dashboard/hmrc-connect" style={styles.secondaryLink}>
            HMRC Connect
          </Link>

          <button onClick={loadClients} style={styles.secondaryButton}>
            Refresh
          </button>
        </div>
      </div>

      {isAdmin && (
        <div style={styles.adminBanner}>
          Admin firm view active. Client data is filtered to the selected firm.
        </div>
      )}

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Clients</span>
          <strong style={styles.statValue}>{stats.total}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>HMRC connected</span>
          <strong style={styles.statValue}>{stats.hmrcConnected}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>With NINO</span>
          <strong style={styles.statValue}>{stats.withNino}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Firm Clients</h2>
            <p style={styles.muted}>
              Open a client to continue the end-to-end MTD ITSA workflow.
            </p>
          </div>
        </div>

        {clients.length === 0 ? (
          <p style={styles.muted}>No clients found for this firm.</p>
        ) : (
          <div style={styles.clientList}>
            {clients.map((client) => {
              const name =
                `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                client.email ||
                "Client";

              return (
                <div key={client.id} style={styles.clientCard}>
                  <div>
                    <h2 style={styles.clientName}>{name}</h2>
                    <p style={styles.muted}>
                      Email: <strong>{client.email || "Not added"}</strong> ·
                      NINO: <strong>{client.nino || "Not added"}</strong> · UTR:{" "}
                      <strong>{client.utr || "Not added"}</strong> · HMRC:{" "}
                      <strong>
                        {client.hmrc_connected ? "Connected" : "Not connected"}
                      </strong>
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    style={styles.openButton}
                  >
                    Open Client
                  </Link>
                </div>
              );
            })}
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 800,
  },
  title: {
    margin: "10px 0 8px",
    fontSize: "34px",
    fontWeight: 900,
  },
  subtitle: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: "15px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
    fontSize: "26px",
    fontWeight: 900,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  sectionTitle: {
    margin: "0 0 6px",
    fontSize: "22px",
    fontWeight: 900,
  },
  clientList: {
    display: "grid",
    gap: "14px",
  },
  clientCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    background: "#fbfdff",
  },
  clientName: {
    margin: "0 0 6px",
    fontSize: "20px",
    fontWeight: 900,
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111827",
    color: "white",
    textDecoration: "none",
    padding: "11px 16px",
    borderRadius: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    textDecoration: "none",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
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
  adminBanner: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: "14px 16px",
    borderRadius: "14px",
    marginBottom: "20px",
    fontWeight: 800,
  },
};