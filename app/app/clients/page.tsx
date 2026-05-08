"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import { supabase } from "../../../lib/supabaseClient";

const CSV_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "nino",
  "utr",
  "client_type",
  "hmrc_authorisation_status",
  "mtd_income_tax_id",
  "date_of_birth",
  "address_line1",
  "address_line2",
  "city",
  "postcode",
  "business_name",
  "client_reference",
  "vat_registration_number",
  "vat_registration_date",
  "eori_number",
  "group_identifier",
  "notes",
];

const CSV_SAMPLE = [
  "Ellis",
  "Yeates",
  "ellis.yeates@example.com",
  "",
  "SN456269C",
  "3702705753",
  "self-employment",
  "authorised",
  "XEIT00819080544",
  "1992-06-14",
  "48 Virgil Street",
  "Uttoxeter",
  "",
  "TS19 1PA",
  "Ellis Trading",
  "EY001",
  "132915481",
  "2006-05-08",
  "GB416047953165",
  "179310549648",
  "Sandbox test client",
];

function clean(value: any) {
  return String(value || "").trim();
}

function cleanNino(value: any) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function getClientName(c: any) {
  const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  return (
    c.name ||
    c.client_name ||
    c.full_name ||
    c.business_name ||
    fullName ||
    "Client"
  );
}

function getClientEmail(c: any) {
  return c.email || c.client_email || "No email";
}

function getClientType(c: any) {
  return c.client_type || c.hmrc_income_source_type || "client";
}

function isOpenStatus(status: any) {
  const s = String(status || "").toLowerCase();
  return !["fulfilled", "submitted", "completed", "success", "accepted"].includes(
    s
  );
}

function daysUntil(dateValue: any) {
  if (!dateValue) return null;
  const today = new Date();
  const due = new Date(dateValue);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function downloadCSVTemplate() {
  const csv = Papa.unparse([CSV_HEADERS, CSV_SAMPLE]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hala-mtd-client-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [firm, setFirm] = useState<any>(null);
  const [firmId, setFirmId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [isAdminView, setIsAdminView] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [message, setMessage] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/auth/login");
      return;
    }

    setUserId(userData.user.id);

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
        .eq("status", "active")
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

    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select(
        `
        *,
        obligations (*),
        tax_years (*),
        tax_year_final_declarations (*)
      `
      )
      .eq("firm_id", activeFirmId)
      .order("created_at", { ascending: false });

    if (clientsError) {
      setMessage(clientsError.message);
      setClients([]);
      setLoading(false);
      return;
    }

    setClients(clientsData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getClientStatus = (client: any) => {
    if (client.archived_at) {
      return {
        label: "Archived",
        bg: "#e2e8f0",
        color: "#475569",
        icon: "•",
        detail: "Hidden from active list",
      };
    }

    const finalDeclarations = client.tax_year_final_declarations || [];

    const hasSubmittedFinalDeclaration = finalDeclarations.some((f: any) => {
      const status = String(f.status || f.review_state || "").toLowerCase();
      return ["submitted", "final_submitted", "complete", "completed"].includes(
        status
      );
    });

    if (hasSubmittedFinalDeclaration) {
      return {
        label: "Submitted",
        bg: "#dcfce7",
        color: "#166534",
        icon: "✓",
        detail: "Final declaration submitted",
      };
    }

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
        detail: `${overdueCount} overdue`,
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

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !firmId) return;

    setUploading(true);

    try {
      const text = await file.text();

      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });

      if (parsed.errors.length) {
        alert(`CSV error: ${parsed.errors[0].message}`);
        return;
      }

      const rows = parsed.data || [];

      const clientsToInsert = rows
        .map((row) => {
          const firstName = clean(row.first_name);
          const lastName = clean(row.last_name);
          const nino = cleanNino(row.nino);
          const utr = clean(row.utr);

          if (!firstName || !lastName) return null;
          if (!nino && !utr) return null;

          const clientType = clean(row.client_type) || "self-employment";
          const hmrcStatus = clean(row.hmrc_authorisation_status) || "unknown";

          return {
            firm_id: firmId,

            first_name: firstName,
            last_name: lastName,
            email: clean(row.email) || null,
            phone: clean(row.phone) || null,
            client_email: clean(row.email) || null,
            client_phone: clean(row.phone) || null,

            nino: nino || null,
            utr: utr || null,
            client_type: clientType,
            hmrc_income_source_type: clientType,
            mtd_status: hmrcStatus,
            hmrc_authorisation_status: hmrcStatus,
            hmrc_connected: hmrcStatus === "authorised",
            hmrc_environment: "sandbox",

            mtd_income_tax_id: clean(row.mtd_income_tax_id) || null,
            date_of_birth: clean(row.date_of_birth) || null,
            address_line1: clean(row.address_line1) || null,
            address_line2: clean(row.address_line2) || null,
            city: clean(row.city) || null,
            postcode: clean(row.postcode).toUpperCase() || null,
            business_name: clean(row.business_name) || null,
            client_reference: clean(row.client_reference) || null,
            vat_registration_number: clean(row.vat_registration_number) || null,
            vat_registration_date: clean(row.vat_registration_date) || null,
            eori_number: clean(row.eori_number) || null,
            group_identifier: clean(row.group_identifier) || null,
            notes: clean(row.notes) || null,
            archived_at: null,
            archived_by: null,
          };
        })
        .filter((client): client is NonNullable<typeof client> => client !== null);

      if (clientsToInsert.length === 0) {
        alert(
          "No valid clients found. First name, last name, and NINO or UTR are required."
        );
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert(clientsToInsert as any[]);

      if (error) {
        alert(error.message);
        return;
      }

      alert(`${clientsToInsert.length} clients uploaded successfully.`);
      await loadDashboard();
    } finally {
      setUploading(false);
    }
  };

  const archiveClient = async (client: any) => {
    const ok = window.confirm(
      `Archive ${getClientName(
        client
      )}? This will hide the client from the active list but keep all HMRC, tax year and audit records safely stored.`
    );

    if (!ok) return;

    setActionLoadingId(client.id);
    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoadingId("");
      return;
    }

    setMessage(`${getClientName(client)} archived successfully.`);
    await loadDashboard();
    setActionLoadingId("");
  };

  const restoreClient = async (client: any) => {
    const ok = window.confirm(`Restore ${getClientName(client)} to active clients?`);
    if (!ok) return;

    setActionLoadingId(client.id);
    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        archived_at: null,
        archived_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoadingId("");
      return;
    }

    setMessage(`${getClientName(client)} restored successfully.`);
    await loadDashboard();
    setActionLoadingId("");
  };

  const countLinkedRows = async (table: string, clientId: string) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (error) return 0;
    return count || 0;
  };

  const deleteClient = async (client: any) => {
    const ok = window.confirm(
      `Delete ${getClientName(
        client
      )}? This is only allowed where there are no tax years, obligations, HMRC submissions or final declaration records. If records exist, archive the client instead.`
    );

    if (!ok) return;

    setActionLoadingId(client.id);
    setMessage("");

    const [taxYearCount, obligationCount, finalDeclarationCount, submissionLogCount] =
      await Promise.all([
        countLinkedRows("tax_years", client.id),
        countLinkedRows("obligations", client.id),
        countLinkedRows("tax_year_final_declarations", client.id),
        countLinkedRows("hmrc_submission_logs", client.id),
      ]);

    const totalLinked =
      taxYearCount + obligationCount + finalDeclarationCount + submissionLogCount;

    if (totalLinked > 0) {
      setMessage(
        `Delete blocked. This client has linked compliance records. Tax years: ${taxYearCount}, obligations: ${obligationCount}, final declarations: ${finalDeclarationCount}, HMRC logs: ${submissionLogCount}. Use Archive instead.`
      );
      setActionLoadingId("");
      return;
    }

    const secondConfirm = window.confirm(
      `Final confirmation: permanently delete ${getClientName(
        client
      )}? This cannot be undone.`
    );

    if (!secondConfirm) {
      setActionLoadingId("");
      return;
    }

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoadingId("");
      return;
    }

    setMessage(`${getClientName(client)} deleted successfully.`);
    await loadDashboard();
    setActionLoadingId("");
  };

  const visibleClients = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return clients.filter((client) => {
      const archived = Boolean(client.archived_at);

      if (!showArchived && archived) return false;

      if (!search) return true;

      const haystack = [
        getClientName(client),
        getClientEmail(client),
        client.nino,
        client.utr,
        client.client_reference,
        client.business_name,
        client.postcode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [clients, showArchived, searchText]);

  const stats = useMemo(() => {
    const activeClients = clients.filter((c) => !c.archived_at);
    const archivedClients = clients.filter((c) => c.archived_at);

    const submittedClients = activeClients.filter(
      (c) => getClientStatus(c).label === "Submitted"
    ).length;

    const overdueClients = activeClients.filter(
      (c) => getClientStatus(c).label === "Overdue"
    ).length;

    const attentionClients = activeClients.filter((c) =>
      ["Needs attention", "Open obligations"].includes(getClientStatus(c).label)
    ).length;

    const hmrcReadyClients = activeClients.filter(
      (c) =>
        c.nino ||
        c.utr ||
        c.mtd_income_tax_id ||
        (c.obligations || []).some((o: any) => o.hmrc_source !== "manual")
    ).length;

    const totalOpenObligations = activeClients.reduce((sum, c) => {
      if (getClientStatus(c).label === "Submitted") return sum;

      return (
        sum +
        (c.obligations || []).filter((o: any) => isOpenStatus(o.status)).length
      );
    }, 0);

    return {
      totalClients: activeClients.length,
      archivedClients: archivedClients.length,
      submittedClients,
      overdueClients,
      attentionClients,
      hmrcReadyClients,
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
            <strong>Admin View: you are viewing this firm dashboard.</strong>

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
              Collaborative MTD ITSA command centre for accountancy firms, HMRC
              obligations, quarterly workflows and final declarations.
            </p>

            <div style={styles.badgeWrap}>
              <span style={styles.greenBadge}>HMRC sandbox enabled</span>
              <span style={styles.blueBadge}>Multi-firm workspace</span>
              <span style={styles.purpleBadge}>MTD ITSA beta</span>
            </div>
          </div>

          <div style={styles.heroActions}>
            <Link href="/dashboard/settings" style={styles.greenButton}>
              HMRC Settings
            </Link>

            <Link href="/app/team" style={styles.blueButton}>
              Team
            </Link>

            <button onClick={handleLogout} style={styles.whiteButton}>
              Logout
            </button>
          </div>
        </section>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.statsGrid}>
          <StatCard label="Active clients" value={stats.totalClients} />
          <StatCard label="Archived" value={stats.archivedClients} color="#475569" />
          <StatCard label="Submitted" value={stats.submittedClients} color="#166534" />
          <StatCard label="Overdue" value={stats.overdueClients} color="#991b1b" />
          <StatCard label="Needs attention" value={stats.attentionClients} color="#92400e" />
          <StatCard label="Open obligations" value={stats.totalOpenObligations} color="#1d4ed8" />
          <StatCard label="HMRC ready" value={stats.hmrcReadyClients} color="#047857" />
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Clients</h2>
              <p style={styles.sectionText}>
                Add, edit, archive or safely delete firm clients. HMRC/audit records
                are protected from accidental deletion.
              </p>
            </div>

            <div style={styles.actions}>
              <button onClick={downloadCSVTemplate} style={styles.whiteActionButton}>
                Download CSV Template
              </button>

              <label style={styles.blueButton}>
                {uploading ? "Uploading..." : "Import CSV"}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  style={{ display: "none" }}
                />
              </label>

              <Link href="/app/clients/new" style={styles.darkButton}>
                Add Client
              </Link>
            </div>
          </div>

          <div style={styles.toolbar}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by name, email, NINO, UTR, reference or postcode..."
              style={styles.searchInput}
            />

            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived clients
            </label>
          </div>

          <div style={styles.clientList}>
            {visibleClients.length === 0 ? (
              <div style={styles.emptyBox}>
                <p style={{ fontWeight: 800 }}>No clients found.</p>
                <p style={{ color: "#64748b", fontSize: 14 }}>
                  Add a client manually, import CSV, or enable archived clients.
                </p>
              </div>
            ) : (
              visibleClients.map((c) => {
                const status = getClientStatus(c);
                const taxYears = c.tax_years || [];
                const obligations = c.obligations || [];
                const openObligations =
                  status.label === "Submitted"
                    ? []
                    : obligations.filter((o: any) => isOpenStatus(o.status));
                const isArchived = Boolean(c.archived_at);
                const isBusy = actionLoadingId === c.id;

                return (
                  <div
                    key={c.id}
                    style={{
                      ...styles.clientRow,
                      opacity: isArchived ? 0.78 : 1,
                    }}
                  >
                    <div>
                      <div style={styles.clientTitleRow}>
                        <h3 style={styles.clientTitle}>{getClientName(c)}</h3>

                        {c.hmrc_authorisation_status && (
                          <span style={styles.hmrcBadge}>
                            HMRC:{" "}
                            {String(c.hmrc_authorisation_status).replace("_", " ")}
                          </span>
                        )}

                        {isArchived && (
                          <span style={styles.archivedBadge}>Archived</span>
                        )}
                      </div>

                      <p style={styles.clientMeta}>
                        {getClientEmail(c)} · {getClientType(c)}
                      </p>

                      <p style={styles.clientSmall}>
                        NINO: {c.nino || "Missing"} · UTR: {c.utr || "Missing"} ·
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

                    <div style={styles.rowActions}>
                      <Link href={`/app/clients/${c.id}`} style={styles.openButton}>
                        Open
                      </Link>

                      <Link
                        href={`/app/clients/${c.id}/edit`}
                        style={styles.editButton}
                      >
                        Edit
                      </Link>

                      {isArchived ? (
                        <button
                          type="button"
                          onClick={() => restoreClient(c)}
                          disabled={isBusy}
                          style={styles.restoreButton}
                        >
                          {isBusy ? "Working..." : "Restore"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => archiveClient(c)}
                          disabled={isBusy}
                          style={styles.archiveButton}
                        >
                          {isBusy ? "Working..." : "Archive"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteClient(c)}
                        disabled={isBusy}
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
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
  message: {
    padding: 16,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    fontWeight: 800,
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
    border: 0,
    cursor: "pointer",
  },
  whiteActionButton: {
    background: "white",
    color: "#0f172a",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 20,
  },
  searchInput: {
    flex: "1 1 420px",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 14,
    outline: "none",
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 14,
    fontWeight: 800,
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
    textTransform: "capitalize",
  },
  archivedBadge: {
    background: "#e2e8f0",
    color: "#475569",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
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
  rowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  openButton: {
    background: "#2563eb",
    color: "white",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    textDecoration: "none",
    fontSize: 13,
  },
  editButton: {
    background: "white",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    textDecoration: "none",
    fontSize: 13,
  },
  archiveButton: {
    background: "#f59e0b",
    color: "white",
    border: 0,
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  },
  restoreButton: {
    background: "#16a34a",
    color: "white",
    border: 0,
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  },
  deleteButton: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  },
};