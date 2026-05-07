"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

function getClientName(c: any) {
  const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();

  return (
    c.name ||
    c.client_name ||
    c.full_name ||
    c.business_name ||
    fullName ||
    "HMRC Imported Client"
  );
}

function getClientEmail(c: any) {
  return c.email || c.client_email || "No email";
}

function getClientType(c: any) {
  return c.client_type || c.type || "client";
}

function isOpenStatus(status: any) {
  const s = String(status || "").toLowerCase();
  return !["fulfilled", "submitted", "completed", "success", "accepted"].includes(s);
}

function daysUntil(dateValue: any) {
  if (!dateValue) return null;

  const today = new Date();
  const due = new Date(dateValue);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [firm, setFirm] = useState<any>(null);
  const [firmId, setFirmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/auth/login");
      return;
    }

    const impersonateFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    let activeFirmId = "";

    if (impersonateFirmId) {
      activeFirmId = impersonateFirmId;
      setIsAdminView(true);
    } else {
      const { data: firmUsers, error: firmUserError } = await supabase
        .from("firm_users")
        .select("firm_id, role, created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (firmUserError || !firmUsers || firmUsers.length === 0) {
        alert("No firm found for this user. Please accept your firm invite first.");
        router.push("/auth/login");
        return;
      }

      activeFirmId = firmUsers[0].firm_id;
      setIsAdminView(false);
    }

    setFirmId(activeFirmId);

    const { data: firmData } = await supabase
      .from("firms")
      .select("*")
      .eq("id", activeFirmId)
      .maybeSingle();

    setFirm(firmData || null);

    const { data: clientsData } = await supabase
      .from("clients")
      .select(
        `
        *,
        obligations (*),
        tax_years (*)
      `
      )
      .eq("firm_id", activeFirmId)
      .order("created_at", { ascending: false });

    setClients(clientsData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const getClientStatus = (client: any) => {
    const obligations = client.obligations || [];
    const openObligations = obligations.filter((o: any) => isOpenStatus(o.status));

    const overdueCount = openObligations.filter((o: any) => {
      const days = daysUntil(o.due_date);
      return days !== null && days < 0;
    }).length;

    if (overdueCount > 0) {
      return {
        label: "Overdue",
        bg: "#fee2e2",
        color: "#991b1b",
        icon: "✕",
        detail: `${overdueCount} overdue obligation${overdueCount === 1 ? "" : "s"}`,
      };
    }

    const upcomingCount = openObligations.filter((o: any) => {
      const days = daysUntil(o.due_date);
      return days !== null && days >= 0 && days <= 14;
    }).length;

    if (upcomingCount > 0) {
      return {
        label: "Needs attention",
        bg: "#fef3c7",
        color: "#92400e",
        icon: "!",
        detail: `${upcomingCount} due soon`,
      };
    }

    if (openObligations.length > 0) {
      return {
        label: "Open obligations",
        bg: "#dbeafe",
        color: "#1d4ed8",
        icon: "•",
        detail: `${openObligations.length} open`,
      };
    }

    return {
      label: "Up to date",
      bg: "#dcfce7",
      color: "#166534",
      icon: "✓",
      detail: "No urgent action",
    };
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("impersonate_firm_id");
    }

    await supabase.auth.signOut();
    window.location.href = "/portal";
  };

  const exitAdminView = () => {
    localStorage.removeItem("impersonate_firm_id");
    window.location.href = "/admin/firms";
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      return row;
    });
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !firmId) return;

    setUploading(true);

    const text = await file.text();
    const rows = parseCSV(text);

    const clientsToInsert = rows.map((row) => ({
      firm_id: firmId,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      name:
        `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
        row.name ||
        "Imported Client",
      email: row.email || "",
      phone: row.phone || "",
      client_email: row.email || "",
      client_phone: row.phone || "",
      client_type: row.client_type || "sole_trader",
    }));

    const { error } = await supabase.from("clients").insert(clientsToInsert);

    setUploading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`${clientsToInsert.length} clients uploaded successfully.`);
    await loadDashboard();
  };

  const stats = useMemo(() => {
    const totalClients = clients.length;

    const overdueClients = clients.filter(
      (c) => getClientStatus(c).label === "Overdue"
    ).length;

    const attentionClients = clients.filter((c) =>
      ["Needs attention", "Open obligations"].includes(getClientStatus(c).label)
    ).length;

    const hmrcImportedClients = clients.filter(
  (c) => c.nino || (c.obligations || []).some((o: any) => o.hmrc_source !== "manual")
).length;

    const totalOpenObligations = clients.reduce((sum, c) => {
      return (
        sum +
        (c.obligations || []).filter((o: any) => isOpenStatus(o.status)).length
      );
    }, 0);

    return {
      totalClients,
      overdueClients,
      attentionClients,
      hmrcImportedClients,
      totalOpenObligations,
    };
  }, [clients]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p>Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {isAdminView && (
          <div style={styles.adminBanner}>
            <strong>Admin View: You are viewing this firm dashboard.</strong>

            <button onClick={exitAdminView} style={styles.amberButton}>
              Exit Admin View
            </button>
          </div>
        )}

        <section style={styles.hero}>
          <div>
            <p style={styles.kicker}>Hala MTD Portal</p>

            <h1 style={styles.heroTitle}>{firm?.name || "Your Firm"}</h1>

            <p style={styles.heroText}>
              Collaborative MTD ITSA command centre for accountancy firms,
              HMRC obligations, quarterly workflows and final declarations.
            </p>

            <div style={styles.badgeWrap}>
              <span style={styles.greenBadge}>HMRC sandbox enabled</span>
              <span style={styles.blueBadge}>Multi-firm workspace</span>
              <span style={styles.purpleBadge}>MTD ITSA beta</span>
            </div>
          </div>

          <div style={styles.heroActions}>
            <Link href="/dashboard/settings" style={styles.greenButton}>
              HMRC Sync
            </Link>

            <Link href="/app/team" style={styles.blueButton}>
              Team
            </Link>

            <button onClick={handleLogout} style={styles.whiteButton}>
              Logout
            </button>
          </div>
        </section>

        <section style={styles.statsGrid}>
          <StatCard label="Total clients" value={stats.totalClients} />
          <StatCard label="Overdue" value={stats.overdueClients} color="#991b1b" />
          <StatCard
            label="Needs attention"
            value={stats.attentionClients}
            color="#92400e"
          />
          <StatCard
            label="Open obligations"
            value={stats.totalOpenObligations}
            color="#1d4ed8"
          />
          <StatCard
            label="HMRC imported"
            value={stats.hmrcImportedClients}
            color="#047857"
          />
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Clients</h2>

              <p style={styles.sectionText}>
                Manage MTD ITSA clients, HMRC obligations, tax years, quarters
                and final declaration workflows.
              </p>
            </div>

            <div style={styles.actions}>
              <label style={styles.blueButton}>
                {uploading ? "Uploading..." : "Upload CSV"}

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  style={{ display: "none" }}
                />
              </label>

              <Link href="/app/clients/new" style={styles.darkButton}>
                Add New Client
              </Link>
            </div>
          </div>

          <div style={styles.clientList}>
            {clients.length === 0 ? (
              <div style={styles.emptyBox}>
                <p style={{ fontWeight: 700 }}>No clients yet.</p>
                <p style={{ color: "#64748b", fontSize: 14 }}>
                  CSV format: first_name,last_name,email,phone,client_type
                </p>
              </div>
            ) : (
              clients.map((c) => {
                const status = getClientStatus(c);
                const taxYears = c.tax_years || [];
                const obligations = c.obligations || [];
                const openObligations = obligations.filter((o: any) =>
                  isOpenStatus(o.status)
                );

                return (
                  <Link
                    key={c.id}
                    href={`/app/clients/${c.id}`}
                    style={styles.clientRow}
                  >
                    <div>
                      <div style={styles.clientTitleRow}>
                        <h3 style={styles.clientTitle}>{getClientName(c)}</h3>

                        {String(c.email || "").includes("@hmrc-import.local") && (
                          <span style={styles.hmrcBadge}>HMRC imported</span>
                        )}
                      </div>

                      <p style={styles.clientMeta}>
                        {getClientEmail(c)} · {getClientType(c)}
                      </p>

                      <p style={styles.clientSmall}>
                        Tax years: {taxYears.length} · Open obligations:{" "}
                        {openObligations.length}
                      </p>
                    </div>

                    <div>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: status.bg,
                          color: status.color,
                        }}
                      >
                        {status.icon} {status.label}
                      </span>
                    </div>

                    <span style={styles.openLink}>Open →</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: any;
  color?: string;
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color }}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 32,
    color: "#0f172a",
  },
  container: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  adminBanner: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 16,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 20,
  },
  hero: {
    background: "#020617",
    color: "white",
    borderRadius: 28,
    padding: 32,
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  },
  kicker: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 700,
  },
  heroTitle: {
    margin: "8px 0 0",
    fontSize: 38,
    lineHeight: 1.1,
    letterSpacing: -1,
  },
  heroText: {
    margin: "12px 0 0",
    maxWidth: 740,
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 1.6,
  },
  badgeWrap: {
    marginTop: 20,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  greenBadge: {
    background: "rgba(34,197,94,.16)",
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,.35)",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
  },
  blueBadge: {
    background: "rgba(59,130,246,.16)",
    color: "#bfdbfe",
    border: "1px solid rgba(59,130,246,.35)",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
  },
  purpleBadge: {
    background: "rgba(168,85,247,.16)",
    color: "#e9d5ff",
    border: "1px solid rgba(168,85,247,.35)",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  greenButton: {
    background: "#16a34a",
    color: "white",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    border: 0,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  blueButton: {
    background: "#2563eb",
    color: "white",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    border: 0,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  darkButton: {
    background: "#020617",
    color: "white",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  whiteButton: {
    background: "white",
    color: "#020617",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    border: 0,
    cursor: "pointer",
  },
  amberButton: {
    background: "#f59e0b",
    color: "white",
    borderRadius: 12,
    padding: "9px 14px",
    fontWeight: 800,
    border: 0,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
  },
  statValue: {
    margin: "8px 0 0",
    fontSize: 34,
    fontWeight: 900,
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 15,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  clientList: {
    marginTop: 22,
    display: "grid",
    gap: 12,
  },
  emptyBox: {
    padding: 32,
    border: "1px dashed #cbd5e1",
    borderRadius: 20,
    textAlign: "center",
  },
  clientRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 18,
    alignItems: "center",
    padding: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "#f8fafc",
    color: "#0f172a",
    textDecoration: "none",
  },
  clientTitleRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  clientTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
  },
  hmrcBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 800,
  },
  clientMeta: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 14,
  },
  clientSmall: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
  },
  statusBadge: {
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  openLink: {
    color: "#2563eb",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
};