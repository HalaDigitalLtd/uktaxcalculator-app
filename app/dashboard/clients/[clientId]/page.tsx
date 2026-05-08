"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [userId, setUserId] = useState("");
  const [firmId, setFirmId] = useState("");
  const [client, setClient] = useState<Row | null>(null);
  const [taxYears, setTaxYears] = useState<Row[]>([]);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [quarterLinks, setQuarterLinks] = useState<Row[]>([]);
  const [finalDeclarations, setFinalDeclarations] = useState<Row[]>([]);
  const [submissionLogsCount, setSubmissionLogsCount] = useState(0);
  const [obligationsCount, setObligationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const money = (value: any) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(Number(value || 0));

  const amount = (row: Row, keys: string[]) => {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null) {
        return Number(row[key]);
      }
    }
    return 0;
  };

  const clientName = useMemo(() => {
    if (!client) return "Client";
    return (
      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
      client.business_name ||
      client.email ||
      "Client"
    );
  }, [client]);

  const isArchived = Boolean(client?.archived_at);

  const resolveFirmId = async () => {
    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data, error } = await supabase.rpc("get_current_active_firm_id", {
      impersonated_firm_id: impersonatedFirmId || null,
    });

    if (error || !data) {
      throw new Error(error?.message || "No firm access found.");
    }

    return String(data);
  };

  const countLinkedRows = async (table: string, activeClientId: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("client_id", activeClientId);

    return count || 0;
  };

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/auth/login";
      return;
    }

    setUserId(userData.user.id);

    let activeFirmId = "";

    try {
      activeFirmId = await resolveFirmId();
      setFirmId(activeFirmId);
    } catch (error: any) {
      setMessage(error?.message || "No firm access found.");
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("firm_id", activeFirmId)
      .maybeSingle();

    if (clientError || !clientData) {
      setMessage(
        clientError?.message || "Client not found or this firm does not have access."
      );
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: yearData, error: yearError } = await supabase
      .from("tax_years")
      .select("*")
      .eq("client_id", clientId)
      .eq("firm_id", activeFirmId)
      .order("year_label", { ascending: false });

    if (yearError) {
      setMessage(`Tax year load error: ${yearError.message}`);
      setLoading(false);
      return;
    }

    const safeYears = yearData || [];
    setTaxYears(safeYears);

    const yearIds = safeYears.map((y) => y.id);

    let safeQuarters: Row[] = [];

    if (yearIds.length > 0) {
      const { data: quarterData, error: quarterError } = await supabase
        .from("quarters")
        .select("*")
        .eq("firm_id", activeFirmId)
        .in("tax_year_id", yearIds)
        .order("start_date", { ascending: true });

      if (quarterError) {
        setMessage(`Quarter load error: ${quarterError.message}`);
        setLoading(false);
        return;
      }

      safeQuarters = quarterData || [];
    }

    setQuarters(safeQuarters);

    const quarterIds = safeQuarters.map((q) => q.id);

    if (quarterIds.length > 0) {
      const { data: linkData } = await supabase
        .from("quarter_obligations")
        .select("*")
        .eq("firm_id", activeFirmId)
        .eq("client_id", clientId)
        .in("quarter_id", quarterIds);

      setQuarterLinks(linkData || []);
    } else {
      setQuarterLinks([]);
    }

    const { data: fdData } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("firm_id", activeFirmId)
      .eq("client_id", clientId);

    setFinalDeclarations(fdData || []);

    const [obCount, logCount] = await Promise.all([
      countLinkedRows("obligations", clientId),
      countLinkedRows("hmrc_submission_logs", clientId),
    ]);

    setObligationsCount(obCount);
    setSubmissionLogsCount(logCount);

    setLoading(false);
  };

  useEffect(() => {
    if (clientId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const latestTaxYear = useMemo(() => {
    if (!taxYears.length) return null;
    return [...taxYears].sort((a, b) =>
      String(b.year_label || "").localeCompare(String(a.year_label || ""))
    )[0];
  }, [taxYears]);

  const yearCards = useMemo(() => {
    return taxYears.map((year) => {
      const yearQuarters = quarters.filter((q) => q.tax_year_id === year.id);
      const yearQuarterIds = yearQuarters.map((q) => q.id);

      const yearQuarterLinks = quarterLinks.filter((l) =>
        yearQuarterIds.includes(l.quarter_id)
      );

      const fd = finalDeclarations.find((f) => f.tax_year_id === year.id);

      let income = 0;
      let expenses = 0;

      yearQuarters.forEach((q) => {
        income += amount(q, [
          "income",
          "income_total",
          "total_income",
          "turnover",
          "sales",
        ]);

        expenses += amount(q, [
          "expenses",
          "expense_total",
          "total_expenses",
          "allowable_expenses",
        ]);
      });

      return {
        year,
        quarters: yearQuarters,
        quarterLinks: yearQuarterLinks,
        finalDeclaration: fd,
        income,
        expenses,
        profit: income - expenses,
      };
    });
  }, [taxYears, quarters, quarterLinks, finalDeclarations]);

  const totals = useMemo(() => {
    return yearCards.reduce(
      (acc, item) => {
        acc.income += item.income;
        acc.expenses += item.expenses;
        acc.profit += item.profit;
        return acc;
      },
      { income: 0, expenses: 0, profit: 0 }
    );
  }, [yearCards]);

  const linkedRecordsTotal =
    taxYears.length + obligationsCount + finalDeclarations.length + submissionLogsCount;

  const openLatestMTDYear = () => {
    if (!latestTaxYear) {
      setMessage("No tax year found for this client.");
      return;
    }

    router.push(
      `/dashboard/clients/${clientId}/tax-years/${latestTaxYear.id}/summary`
    );
  };

  const syncHMRC = async () => {
    if (!client) return;

    if (isArchived) {
      setMessage("Archived clients cannot be synced. Restore the client first.");
      return;
    }

    setSyncing(true);
    setMessage("Syncing HMRC obligations...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setMessage("Session expired. Please login again.");
        setSyncing(false);
        return;
      }

      const response = await fetch("/api/hmrc/obligations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ clientId, nino: client.nino }),
      });

      const result = await response.json();

      if (!response.ok || result?.success === false) {
        setMessage(result?.error || result?.message || "HMRC sync failed.");
        setSyncing(false);
        return;
      }

      setMessage(
        `HMRC obligations synced successfully. Saved: ${
          result.saved ?? 0
        }, Failed: ${result.failed ?? 0}, Matched: ${result.matched ?? 0}`
      );

      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "HMRC sync failed unexpectedly.");
    }

    setSyncing(false);
  };

  const archiveClient = async () => {
    if (!client || !firmId) return;

    const ok = window.confirm(
      `Archive ${clientName}? This will hide the client from the active list but keep all HMRC, tax year and audit records safely stored.`
    );

    if (!ok) return;

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoading(false);
      return;
    }

    setMessage(`${clientName} archived successfully.`);
    await loadData();
    setActionLoading(false);
  };

  const restoreClient = async () => {
    if (!client || !firmId) return;

    const ok = window.confirm(`Restore ${clientName} to active clients?`);
    if (!ok) return;

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        archived_at: null,
        archived_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoading(false);
      return;
    }

    setMessage(`${clientName} restored successfully.`);
    await loadData();
    setActionLoading(false);
  };

  const deleteClient = async () => {
    if (!client || !firmId) return;

    const ok = window.confirm(
      `Delete ${clientName}? This is only allowed if there are no tax years, obligations, final declarations or HMRC logs.`
    );

    if (!ok) return;

    setActionLoading(true);
    setMessage("");

    const [taxYearCount, obligationCount, finalDeclarationCount, submissionLogCount] =
      await Promise.all([
        countLinkedRows("tax_years", clientId),
        countLinkedRows("obligations", clientId),
        countLinkedRows("tax_year_final_declarations", clientId),
        countLinkedRows("hmrc_submission_logs", clientId),
      ]);

    const totalLinked =
      taxYearCount + obligationCount + finalDeclarationCount + submissionLogCount;

    if (totalLinked > 0) {
      setMessage(
        `Delete blocked. This client has linked compliance records. Tax years: ${taxYearCount}, obligations: ${obligationCount}, final declarations: ${finalDeclarationCount}, HMRC logs: ${submissionLogCount}. Use Archive instead.`
      );
      setActionLoading(false);
      return;
    }

    const secondConfirm = window.confirm(
      `Final confirmation: permanently delete ${clientName}? This cannot be undone.`
    );

    if (!secondConfirm) {
      setActionLoading(false);
      return;
    }

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("firm_id", firmId);

    if (error) {
      setMessage(error.message);
      setActionLoading(false);
      return;
    }

    router.push("/dashboard/clients");
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading client control centre...</div>
      </main>
    );
  }

  if (!client) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <Link href="/dashboard/clients" style={styles.backLink}>
            ← Back to clients
          </Link>
          <h1 style={styles.title}>Client not found</h1>
          {message && <div style={styles.message}>{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link href="/dashboard/clients" style={styles.backLink}>
            ← Back to clients
          </Link>

          <div style={styles.titleRow}>
            <h1 style={styles.title}>{clientName}</h1>

            {isArchived && <span style={styles.archivedBadge}>Archived</span>}
          </div>

          <p style={styles.subtitle}>
            Email: <strong>{client?.email || "Not added"}</strong> · Phone:{" "}
            <strong>{client?.phone || client?.client_phone || "Not added"}</strong>
          </p>

          <p style={styles.subtitle}>
            NINO: <strong>{client?.nino || "Not added"}</strong> · UTR:{" "}
            <strong>{client?.utr || "Not added"}</strong> · Client ref:{" "}
            <strong>{client?.client_reference || "Not added"}</strong>
          </p>

          <p style={styles.subtitle}>
            HMRC:{" "}
            <strong>{client?.hmrc_connected ? "Connected" : "Not connected"}</strong>{" "}
            · Authorisation:{" "}
            <strong>{client?.hmrc_authorisation_status || "Not set"}</strong> ·
            Income source:{" "}
            <strong>{client?.hmrc_income_source_type || "Not set"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <Link
            href={`/dashboard/clients/${clientId}/edit`}
            style={styles.editButton}
          >
            Edit Client
          </Link>

          {isArchived ? (
            <button
              onClick={restoreClient}
              disabled={actionLoading}
              style={styles.restoreButton}
            >
              {actionLoading ? "Working..." : "Restore"}
            </button>
          ) : (
            <button
              onClick={archiveClient}
              disabled={actionLoading}
              style={styles.archiveButton}
            >
              {actionLoading ? "Working..." : "Archive"}
            </button>
          )}

          <button
            onClick={deleteClient}
            disabled={actionLoading}
            style={styles.deleteButton}
          >
            Delete
          </button>

          <button
            onClick={syncHMRC}
            disabled={syncing || actionLoading || isArchived}
            style={styles.secondaryButton}
          >
            {syncing ? "Syncing..." : "Sync HMRC"}
          </button>

          <button
            onClick={openLatestMTDYear}
            disabled={isArchived}
            style={styles.primaryButton}
          >
            Open latest MTD year
          </button>
        </div>
      </div>

      {isArchived && (
        <div style={styles.archiveNotice}>
          This client is archived. Compliance records are preserved, but HMRC sync
          and MTD workflow actions are disabled until restored.
        </div>
      )}

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Tax years</span>
          <strong style={styles.statValue}>{taxYears.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Quarters</span>
          <strong style={styles.statValue}>{quarters.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Quarter links</span>
          <strong style={styles.statValue}>{quarterLinks.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Linked records</span>
          <strong style={styles.statValue}>{linkedRecordsTotal}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total profit</span>
          <strong style={styles.statValue}>{money(totals.profit)}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Client Management</h2>

        <div style={styles.infoGrid}>
          <div>
            <span style={styles.infoLabel}>Business name</span>
            <strong>{client.business_name || "Not added"}</strong>
          </div>

          <div>
            <span style={styles.infoLabel}>MTD Income Tax ID</span>
            <strong>{client.mtd_income_tax_id || "Not added"}</strong>
          </div>

          <div>
            <span style={styles.infoLabel}>VAT number</span>
            <strong>{client.vat_registration_number || "Not added"}</strong>
          </div>

          <div>
            <span style={styles.infoLabel}>EORI number</span>
            <strong>{client.eori_number || "Not added"}</strong>
          </div>

          <div>
            <span style={styles.infoLabel}>Postcode</span>
            <strong>{client.postcode || "Not added"}</strong>
          </div>

          <div>
            <span style={styles.infoLabel}>Archive status</span>
            <strong>{isArchived ? "Archived" : "Active"}</strong>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>MTD Tax Years</h2>

        {yearCards.length === 0 ? (
          <p style={styles.muted}>No MTD tax years found.</p>
        ) : (
          <div style={styles.yearList}>
            {yearCards.map((item) => {
              const fdStatus =
                item.finalDeclaration?.status ||
                item.finalDeclaration?.review_state ||
                "Not started";

              return (
                <div key={item.year.id} style={styles.yearCard}>
                  <div>
                    <h3 style={styles.yearTitle}>{item.year.year_label}</h3>

                    <p style={styles.muted}>
                      Quarters: {item.quarters.length} · Quarter links:{" "}
                      {item.quarterLinks.length} · Final declaration:{" "}
                      <strong>{String(fdStatus).replaceAll("_", " ")}</strong>
                    </p>
                  </div>

                  <div style={styles.yearNumbers}>
                    <span>Income: {money(item.income)}</span>
                    <span>Expenses: {money(item.expenses)}</span>
                    <strong>Profit: {money(item.profit)}</strong>
                  </div>

                  <div style={styles.yearActions}>
                    <Link
                      href={`/dashboard/clients/${clientId}/tax-years/${item.year.id}/summary`}
                      style={styles.openButton}
                    >
                      Summary
                    </Link>

                    <Link
                      href={`/dashboard/clients/${clientId}/tax-years/${item.year.id}/final-declaration`}
                      style={styles.finalButton}
                    >
                      Final Declaration
                    </Link>
                  </div>
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
    gap: "24px",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  titleRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
  },
  title: {
    margin: "10px 0 8px",
    fontSize: "34px",
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtitle: {
    margin: "4px 0",
    color: "#64748b",
    fontSize: "15px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    border: "none",
    background: "#111827",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
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
  editButton: {
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
  archiveButton: {
    border: "none",
    background: "#f59e0b",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  restoreButton: {
    border: "none",
    background: "#16a34a",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 900,
    cursor: "pointer",
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
  archiveNotice: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    padding: "14px 16px",
    borderRadius: "14px",
    marginBottom: "20px",
    fontWeight: 800,
  },
  archivedBadge: {
    background: "#e2e8f0",
    color: "#475569",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "13px",
    fontWeight: 900,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
    letterSpacing: "0.04em",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 900,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
    marginBottom: "20px",
  },
  sectionTitle: {
    margin: "0 0 18px",
    fontSize: "22px",
    fontWeight: 900,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "5px",
    fontWeight: 800,
    textTransform: "uppercase",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  yearList: {
    display: "grid",
    gap: "14px",
  },
  yearCard: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr auto",
    gap: "16px",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    background: "#fbfdff",
  },
  yearTitle: {
    margin: "0 0 6px",
    fontSize: "18px",
    fontWeight: 900,
  },
  yearNumbers: {
    display: "grid",
    gap: "4px",
    fontSize: "14px",
    color: "#334155",
  },
  yearActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#2563eb",
    color: "white",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  finalButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#7e22ce",
    color: "white",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
};