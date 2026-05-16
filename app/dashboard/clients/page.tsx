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

export default function DashboardClientsPage() {
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
      router.replace("/auth/login");
      return;
    }

    setUserId(userData.user.id);

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: isHalaAdmin } = await supabase.rpc("is_hala_admin");

    const { data: resolvedFirmId, error: firmResolveError } = await supabase.rpc(
      "get_current_active_firm_id",
      {
        impersonated_firm_id: impersonatedFirmId || null,
      }
    );

    if (firmResolveError || !resolvedFirmId) {
      setMessage(
        firmResolveError?.message ||
          "Your account is not linked to an active firm workspace. Please contact your firm administrator."
      );
      setClients([]);
      setFirm(null);
      setFirmId("");
      setLoading(false);
      return;
    }

    const activeFirmId = resolvedFirmId;
    setFirmId(activeFirmId);
    setIsAdminView(Boolean(isHalaAdmin && impersonatedFirmId));

    const { data: firmData, error: firmError } = await supabase
      .from("firms")
      .select("*")
      .eq("id", activeFirmId)
      .maybeSingle();

    if (firmError) {
      setMessage(firmError.message);
      setFirm(null);
      setClients([]);
      setLoading(false);
      return;
    }

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
        bg: "#f2f4f7",
        color: "#475467",
        icon: "â€¢",
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
        bg: "#ecfdf3",
        color: "#067647",
        icon: "âœ“",
        detail: "Final declaration submitted",
      };
    }

    const obligations = client.obligations || [];
    const openObligations = obligations.filter((o: any) =>
      isOpenStatus(o.status)
    );

    const overdueCount = openObligations.filter((o: any) => {
      const days = daysUntil(o.due_date);
      return days !== null && days < 0;
    }).length;

    if (overdueCount > 0) {
      return {
        label: "Overdue",
        bg: "#fff1f2",
        color: "#be123c",
        icon: "!",
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
        bg: "#fffbeb",
        color: "#92400e",
        icon: "!",
        detail: `${upcomingCount} due soon`,
      };
    }

    if (openObligations.length > 0) {
      return {
        label: "Open obligations",
        bg: "#eff8ff",
        color: "#175cd3",
        icon: "â€¢",
        detail: `${openObligations.length} open`,
      };
    }

    return {
      label: "Up to date",
      bg: "#ecfdf3",
      color: "#067647",
      icon: "âœ“",
      detail: "No urgent action",
    };
  };

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("impersonate_firm_id");
    }

    await supabase.auth.signOut();
    window.location.href = "/auth/login";
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
        <div style={styles.loadingCard}>Loading client workspace...</div>
      </main>
    );
  }

  if (!firmId) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.sectionTitle}>Firm access required</h1>
          <p style={styles.sectionText}>{message}</p>
          <div style={styles.actions}>
            <Link href="/auth/login" style={styles.darkButton}>
              Back to Login
            </Link>
            <Link href="/auth/register" style={styles.blueButton}>
              Register Firm
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {isAdminView && (
        <div style={styles.adminBanner}>
          <strong>Admin view: you are viewing this firm workspace.</strong>

          <button onClick={exitAdminView} style={styles.amberButton}>
            Exit Admin View
          </button>
        </div>
      )}

      <section style={styles.header}>
        <div>
          <p style={styles.kicker}>Client workspace</p>
          <h1 style={styles.title}>{firm?.name || "Clients"}</h1>
          <p style={styles.subtitle}>
            Manage client records, HMRC readiness and MTD ITSA operational status.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button onClick={downloadCSVTemplate} style={styles.lightButton}>
            CSV template
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

          <Link href="/dashboard/clients/new" style={styles.darkButton}>
            Add client
          </Link>
        </div>
      </section>

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statStrip}>
        <StatCard label="Active" value={stats.totalClients} />
        <StatCard label="Archived" value={stats.archivedClients} color="#475569" />
        <StatCard label="Submitted" value={stats.submittedClients} color="#067647" />
        <StatCard label="Overdue" value={stats.overdueClients} color="#be123c" />
        <StatCard label="Attention" value={stats.attentionClients} color="#92400e" />
        <StatCard label="Open obligations" value={stats.totalOpenObligations} color="#175cd3" />
        <StatCard label="HMRC ready" value={stats.hmrcReadyClients} color="#047857" />
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Client list</h2>
            <p style={styles.sectionText}>
              Search, open, edit or safely archive clients. Deletion is blocked when compliance records exist.
            </p>
          </div>

          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        <div style={styles.toolbar}>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search name, email, NINO, UTR, reference or postcode..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.table}>
          <div style={styles.tableHead}>
            <span>Client</span>
            <span>Tax / HMRC</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {visibleClients.length === 0 ? (
            <div style={styles.emptyBox}>
              <strong>No clients found.</strong>
              <p>Add a client, import CSV, or enable archived clients.</p>
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
                    opacity: isArchived ? 0.72 : 1,
                  }}
                >
                  <div style={styles.clientMain}>
                    <div style={styles.clientTitleRow}>
                      <Link href={`/dashboard/clients/${c.id}`} style={styles.clientTitle}>
                        {getClientName(c)}
                      </Link>

                      {isArchived && <span style={styles.archivedBadge}>Archived</span>}
                    </div>

                    <div style={styles.clientMeta}>
                      {getClientEmail(c)} Â· {getClientType(c)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.taxLine}>NINO: {c.nino || "Missing"}</div>
                    <div style={styles.taxLine}>UTR: {c.utr || "Missing"}</div>
                    <div style={styles.taxLine}>
                      Years: {taxYears.length} Â· Open: {openObligations.length}
                    </div>

                    {c.hmrc_authorisation_status && (
                      <span style={styles.hmrcBadge}>
                        HMRC: {String(c.hmrc_authorisation_status).replace("_", " ")}
                      </span>
                    )}
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

                    <div style={styles.statusDetail}>{status.detail}</div>
                  </div>

                  <div style={styles.rowActions}>
                    <Link href={`/dashboard/clients/${c.id}`} style={styles.openButton}>
                      Open
                    </Link>

                    <Link href={`/dashboard/clients/${c.id}/edit`} style={styles.editButton}>
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
    </main>
  );
}

function StatCard({
  label,
  value,
  color = "#172033",
}: {
  label: string;
  value: any;
  color?: string;
}) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={{ ...styles.statValue, color }}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gap: 14,
    color: "#172033",
  },
  loadingCard: {
    background: "white",
    border: "1px solid #e6eaf0",
    borderRadius: 16,
    padding: 16,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
  },
  adminBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "#fff8eb",
    color: "#92400e",
    border: "1px solid #fedf89",
    borderRadius: 14,
    fontSize: 12,
  },
  message: {
    padding: "10px 12px",
    background: "#eff8ff",
    color: "#175cd3",
    border: "1px solid #b2ddff",
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 750,
  },
  header: {
    background: "#ffffff",
    border: "1px solid #e6eaf0",
    borderRadius: 18,
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  kicker: {
    margin: 0,
    color: "#64748b",
    fontSize: 10.5,
    fontWeight: 850,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 21,
    lineHeight: 1.15,
    fontWeight: 850,
    letterSpacing: -0.5,
    color: "#111827",
  },
  subtitle: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  statStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
    gap: 8,
  },
  statCard: {
    background: "white",
    border: "1px solid #e6eaf0",
    borderRadius: 14,
    padding: "10px 11px",
    display: "grid",
    gap: 4,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 10.5,
    fontWeight: 750,
  },
  statValue: {
    fontSize: 21,
    lineHeight: 1,
    letterSpacing: -0.5,
  },
  card: {
    background: "white",
    border: "1px solid #e6eaf0",
    borderRadius: 18,
    padding: 14,
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 850,
    color: "#111827",
    letterSpacing: -0.3,
  },
  sectionText: {
    margin: "4px 0 0",
    color: "#667085",
    fontSize: 12,
    lineHeight: 1.4,
  },
  toolbar: {
    marginTop: 12,
  },
  searchInput: {
    width: "100%",
    border: "1px solid #d7dde7",
    borderRadius: 12,
    padding: "9px 11px",
    fontSize: 12.5,
    outline: "none",
    background: "#fbfcfd",
    boxSizing: "border-box",
  },
  table: {
    marginTop: 12,
    border: "1px solid #eef1f5",
    borderRadius: 15,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.025)",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1.35fr) minmax(210px, 1fr) minmax(150px, .75fr) auto",
    gap: 12,
    padding: "10px 12px",
    background: "#f8fafc",
    borderBottom: "1px solid #eef1f5",
    color: "#64748b",
    fontSize: 10.5,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  clientRow: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1.35fr) minmax(210px, 1fr) minmax(150px, .75fr) auto",
    gap: 12,
    alignItems: "center",
    padding: "11px 12px",
    borderBottom: "1px solid #eef1f5",
    background: "#ffffff",
    transition: "background 120ms ease, box-shadow 120ms ease",
  },
  clientMain: {
    minWidth: 0,
  },
  clientTitleRow: {
    display: "flex",
    gap: 7,
    alignItems: "center",
    flexWrap: "wrap",
  },
  clientTitle: {
    color: "#111827",
    fontSize: 13.25,
    fontWeight: 850,
    textDecoration: "none",
  },
  clientMeta: {
    marginTop: 4,
    color: "#667085",
    fontSize: 11.25,
    lineHeight: 1.35,
  },
  taxLine: {
    color: "#475467",
    fontSize: 11.5,
    lineHeight: 1.45,
  },
  hmrcBadge: {
    display: "inline-flex",
    marginTop: 5,
    background: "#ecfdf3",
    color: "#067647",
    border: "1px solid #abefc6",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10.5,
    fontWeight: 800,
    textTransform: "capitalize",
  },
  archivedBadge: {
    background: "#f2f4f7",
    color: "#475467",
    border: "1px solid #e4e7ec",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10.5,
    fontWeight: 800,
  },
  statusBadge: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  statusDetail: {
    marginTop: 5,
    color: "#98a2b3",
    fontSize: 10.5,
    fontWeight: 700,
  },
  rowActions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  lightButton: {
    background: "white",
    color: "#172033",
    borderRadius: 9,
    padding: "7px 11px",
    fontWeight: 800,
    border: "1px solid #d7dde7",
    cursor: "pointer",
    fontSize: 11.5,
  },
  blueButton: {
    background: "#eff8ff",
    color: "#175cd3",
    border: "1px solid #b2ddff",
    borderRadius: 9,
    padding: "7px 11px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11.5,
  },
  darkButton: {
    background: "#172033",
    color: "white",
    borderRadius: 9,
    padding: "7px 11px",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    cursor: "pointer",
    fontSize: 11.5,
  },
  amberButton: {
    background: "#fff8eb",
    color: "#92400e",
    border: "1px solid #fedf89",
    borderRadius: 9,
    padding: "7px 11px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 11.5,
  },
  toggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    color: "#475467",
    fontSize: 11.5,
    fontWeight: 750,
  },
  openButton: {
    background: "#172033",
    color: "white",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 850,
    textDecoration: "none",
    fontSize: 11,
  },
  editButton: {
    background: "white",
    color: "#172033",
    border: "1px solid #d7dde7",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 850,
    textDecoration: "none",
    fontSize: 11,
  },
  archiveButton: {
    background: "#fff8eb",
    color: "#92400e",
    border: "1px solid #fedf89",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: 11,
  },
  restoreButton: {
    background: "#ecfdf3",
    color: "#067647",
    border: "1px solid #abefc6",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: 11,
  },
  deleteButton: {
    background: "#fffafa",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: 11,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  emptyBox: {
    padding: 22,
    textAlign: "center",
    background: "#fbfcfd",
    borderTop: "1px solid #eef1f5",
    color: "#667085",
    fontSize: 12,
  },
};