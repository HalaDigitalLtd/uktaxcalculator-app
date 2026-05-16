"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

type Row = Record<string, any>;

function formatDate(value: any) {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function readable(value: any) {
  return String(value || "Not set").replaceAll("_", " ");
}

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
  const [incomeSources, setIncomeSources] = useState<Row[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<Row | null>(null);
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

    if (error || !data) throw new Error(error?.message || "No firm access found.");
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

    const { data: incomeSourceData } = await supabase
      .from("hmrc_income_sources")
      .select("*")
      .eq("client_id", clientId)
      .eq("firm_id", activeFirmId)
      .order("type_of_business", { ascending: true });

    setIncomeSources(incomeSourceData || []);

    const { data: snapshotData } = await supabase
      .from("hmrc_profile_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .eq("firm_id", activeFirmId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestSnapshot(snapshotData || null);

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
        income += amount(q, ["income", "income_total", "total_income", "turnover", "sales"]);
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

  const incomeSourceSummary = useMemo<Row[]>(() => {
    return incomeSources.map((source) => {
      const sourceObligations = quarterLinks.filter((link) => {
        const raw = link.hmrc_response || {};
        return (
          raw.businessId === source.hmrc_business_id ||
          link.hmrc_business_id === source.hmrc_business_id
        );
      });

      return {
        ...source,
        linkedObligations: sourceObligations.length,
      };
    });
  }, [incomeSources, quarterLinks]);

  const syncWarnings = Array.isArray(latestSnapshot?.sync_warnings)
    ? latestSnapshot?.sync_warnings
    : [];

  const linkedRecordsTotal =
    taxYears.length + obligationsCount + finalDeclarations.length + submissionLogsCount;

  const openLatestMTDYear = () => {
    if (!latestTaxYear) {
      setMessage("No tax year found for this client.");
      return;
    }

    router.push(`/dashboard/clients/${clientId}/tax-years/${latestTaxYear.id}/summary`);
  };

  const connectHMRC = async () => {
    if (!client) return;

    if (isArchived) {
      setMessage("Archived clients cannot be connected to HMRC. Restore the client first.");
      return;
    }

    setSyncing(true);
    setMessage("Starting HMRC sandbox authorisation...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setMessage("Session expired. Please login again.");
        setSyncing(false);
        return;
      }

      const response = await fetch("/api/hmrc/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ clientId }),
      });

      const result = await response.json();

      if (!response.ok || !result?.authUrl) {
        setMessage(result?.error || "Unable to start HMRC connection.");
        setSyncing(false);
        return;
      }

      window.location.href = result.authUrl;
    } catch (error: any) {
      setMessage(error?.message || "Unable to start HMRC connection.");
      setSyncing(false);
    }
  };

  const syncHMRC = async () => {
    if (!client) return;

    if (isArchived) {
      setMessage("Archived clients cannot be synced. Restore the client first.");
      return;
    }

    setSyncing(true);
    setMessage("Syncing HMRC obligations, income sources and evidence...");

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
        const needsHmrcConnect =
          result?.connectRequired ||
          result?.code === "HMRC_CONNECTION_REQUIRED" ||
          String(result?.error || "").toLowerCase().includes("hmrc connection not found") ||
          String(result?.error || "").toLowerCase().includes("no valid hmrc access token");

        if (needsHmrcConnect) {
          setMessage("HMRC connection required. Redirecting to HMRC sandbox...");
          const connectResponse = await fetch("/api/hmrc/connect", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ clientId }),
          });

          const connectResult = await connectResponse.json();

          if (!connectResponse.ok || !connectResult?.authUrl) {
            setMessage(
              connectResult?.error ||
                "Unable to start HMRC connection. Please try from HMRC Connect page."
            );
            setSyncing(false);
            return;
          }

          window.location.href = connectResult.authUrl;
          return;
        }

        setMessage(result?.error || result?.message || "HMRC sync failed.");
        setSyncing(false);
        return;
      }

      setMessage(
        `HMRC synced. Obligations saved: ${result.saved ?? 0}, income sources saved: ${
          result.incomeSourcesSaved ?? 0
        }, matched: ${result.matched ?? 0}.`
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
            Primary source:{" "}
            <strong>{client?.hmrc_income_source_type || "Not set"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <Link href={`/dashboard/clients/${clientId}/edit`} style={styles.editButton}>
            Edit Client
          </Link>

          {isArchived ? (
            <button onClick={restoreClient} disabled={actionLoading} style={styles.restoreButton}>
              {actionLoading ? "Working..." : "Restore"}
            </button>
          ) : (
            <button onClick={archiveClient} disabled={actionLoading} style={styles.archiveButton}>
              {actionLoading ? "Working..." : "Archive"}
            </button>
          )}

          <button onClick={deleteClient} disabled={actionLoading} style={styles.deleteButton}>
            Delete
          </button>

          {client?.hmrc_connected ? (
            <button
              onClick={syncHMRC}
              disabled={syncing || actionLoading || isArchived}
              style={styles.secondaryButton}
            >
              {syncing ? "Syncing..." : "Sync HMRC"}
            </button>
          ) : (
            <button
              onClick={connectHMRC}
              disabled={syncing || actionLoading || isArchived}
              style={styles.secondaryButton}
            >
              {syncing ? "Connecting..." : "Connect HMRC"}
            </button>
          )}

          <button onClick={openLatestMTDYear} disabled={isArchived} style={styles.primaryButton}>
            Open latest MTD year
          </button>
        </div>
      </div>

      {isArchived && (
        <div style={styles.archiveNotice}>
          This client is archived. Compliance records are preserved, but HMRC sync and
          MTD workflow actions are disabled until restored.
        </div>
      )}

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statsGrid}>
        <StatCard label="Tax years" value={taxYears.length} />
        <StatCard label="Quarters" value={quarters.length} />
        <StatCard label="Quarter links" value={quarterLinks.length} />
        <StatCard label="Linked records" value={linkedRecordsTotal} />
        <StatCard label="Total profit" value={money(totals.profit)} />
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>HMRC Evidence & Income Sources</h2>

        <div style={styles.evidenceGrid}>
          <div style={styles.evidenceBox}>
            <span style={styles.infoLabel}>Latest snapshot status</span>
            <strong>{readable(latestSnapshot?.sync_status)}</strong>
            <p style={styles.muted}>Created: {formatDate(latestSnapshot?.created_at)}</p>
          </div>

          <div style={styles.evidenceBox}>
            <span style={styles.infoLabel}>Environment</span>
            <strong>{latestSnapshot?.environment || client.hmrc_environment || "sandbox"}</strong>
            <p style={styles.muted}>Source: {latestSnapshot?.source || "Not synced"}</p>
          </div>

          <div style={styles.evidenceBox}>
            <span style={styles.infoLabel}>Detected income sources</span>
            <strong>{incomeSources.length}</strong>
            <p style={styles.muted}>Primary: {client.hmrc_business_id || "Not stored"}</p>
          </div>
        </div>

        {syncWarnings.length > 0 && (
          <div style={styles.warningBox}>
            <strong>Profile warnings</strong>
            <ul style={styles.warningList}>
              {syncWarnings.map((warning: string, index: number) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Client Management</h2>

        <div style={styles.infoGrid}>
          <Info label="Business name" value={client.business_name || "Not added"} />
          <Info label="MTD Income Tax ID" value={client.mtd_income_tax_id || "Not added"} />
          <Info label="VAT number" value={client.vat_registration_number || "Not added"} />
          <Info label="EORI number" value={client.eori_number || "Not added"} />
          <Info label="Postcode" value={client.postcode || "Not added"} />
          <Info label="Archive status" value={isArchived ? "Archived" : "Active"} />
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

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span style={styles.infoLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "24px",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "flex-start",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  titleRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  backLink: {
    color: "#475569",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 4px",
    fontSize: "28px",
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "2px 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    border: "none",
    background: "#0f172a",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #dbe3ee",
    background: "white",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  editButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #dbe3ee",
    background: "white",
    color: "#0f172a",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
  },
  archiveButton: {
    border: "none",
    background: "#f59e0b",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  restoreButton: {
    border: "none",
    background: "#16a34a",
    color: "white",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#b91c1c",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },
  message: {
    background: "#eef4ff",
    border: "1px solid #d8e5ff",
    color: "#1e3a8a",
    padding: "12px 14px",
    borderRadius: "12px",
    marginBottom: "16px",
    fontWeight: 600,
    fontSize: "13px",
  },
  archiveNotice: {
    background: "#f8fafc",
    border: "1px solid #dbe3ee",
    color: "#475569",
    padding: "12px 14px",
    borderRadius: "12px",
    marginBottom: "16px",
    fontWeight: 700,
    fontSize: "13px",
  },
  archivedBadge: {
    background: "#e2e8f0",
    color: "#475569",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  statCard: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: "14px",
    padding: "13px 14px",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.035)",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 700,
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },
  card: {
    background: "white",
    border: "1px solid #e7edf5",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.035)",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: "16px",
    fontWeight: 800,
    letterSpacing: "-0.01em",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  evidenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },
  evidenceBox: {
    border: "1px solid #e7edf5",
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "14px",
  },
  warningBox: {
    background: "#fffbea",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "14px",
    fontSize: "13px",
  },
  warningList: {
    margin: "8px 0 0",
    paddingLeft: "18px",
  },
  sourceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
  },
  sourceCard: {
    border: "1px solid #e3ebf5",
    background: "#f8fbff",
    borderRadius: "16px",
    padding: "14px",
  },
  sourceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
  },
  sourceId: {
    margin: "6px 0 12px",
    color: "#334155",
    fontWeight: 700,
    fontSize: "12px",
    wordBreak: "break-word",
  },
  sourceMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
  },
  greenPill: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 800,
  },
  greyPill: {
    background: "#e2e8f0",
    color: "#475569",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 800,
  },
  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "4px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  yearList: {
    display: "grid",
    gap: "12px",
  },
  yearCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(170px, 0.8fr) auto",
    gap: "12px",
    alignItems: "center",
    border: "1px solid #e7edf5",
    borderRadius: "14px",
    padding: "14px",
    background: "#fcfdff",
  },
  yearTitle: {
    margin: "0 0 3px",
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: "-0.01em",
  },
  yearNumbers: {
    display: "grid",
    gap: "2px",
    fontSize: "12.5px",
    color: "#334155",
  },
  yearActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#172033",
    color: "white",
    textDecoration: "none",
    padding: "7px 11px",
    borderRadius: "9px",
    fontWeight: 750,
    fontSize: "11.5px",
    whiteSpace: "nowrap",
  },
  finalButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fbff",
    color: "#175cd3",
    border: "1px solid #b2ddff",
    textDecoration: "none",
    padding: "7px 11px",
    borderRadius: "9px",
    fontWeight: 750,
    fontSize: "11.5px",
    whiteSpace: "nowrap",
  },
};

