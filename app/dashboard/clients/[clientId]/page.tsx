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

  const [client, setClient] = useState<Row | null>(null);
  const [firmId, setFirmId] = useState("");
  const [taxYears, setTaxYears] = useState<Row[]>([]);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [quarterLinks, setQuarterLinks] = useState<Row[]>([]);
  const [finalDeclarations, setFinalDeclarations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      client.email ||
      "Client"
    );
  }, [client]);

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

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/auth/login";
      return;
    }

    let resolvedFirmId = "";

    try {
      resolvedFirmId = await resolveFirmId();
      setFirmId(resolvedFirmId);
    } catch (error: any) {
      setMessage(error?.message || "No firm access found.");
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("firm_id", resolvedFirmId)
      .maybeSingle();

    if (clientError || !clientData) {
      setMessage(
        clientError?.message ||
          "Client not found or this firm does not have access."
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
      .eq("firm_id", resolvedFirmId)
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
        .eq("firm_id", resolvedFirmId)
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
      const { data: linkData, error: linkError } = await supabase
        .from("quarter_obligations")
        .select("*")
        .eq("firm_id", resolvedFirmId)
        .eq("client_id", clientId)
        .in("quarter_id", quarterIds);

      if (linkError) {
        setMessage(`Quarter obligation link error: ${linkError.message}`);
        setLoading(false);
        return;
      }

      setQuarterLinks(linkData || []);
    } else {
      setQuarterLinks([]);
    }

    const { data: fdData, error: fdError } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("firm_id", resolvedFirmId)
      .eq("client_id", clientId);

    if (!fdError) {
      setFinalDeclarations(fdData || []);
    } else {
      setFinalDeclarations([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (clientId) loadData();
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

    setSyncing(true);
    setMessage("Syncing HMRC obligations...");

    try {
      const response = await fetch("/api/hmrc/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        }, Failed: ${result.failed ?? 0}`
      );

      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "HMRC sync failed unexpectedly.");
    }

    setSyncing(false);
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading client control centre...</div>
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

          <h1 style={styles.title}>{clientName}</h1>

          <p style={styles.subtitle}>
            Firm ID: <strong>{firmId || "Not resolved"}</strong>
          </p>

          <p style={styles.subtitle}>
            Email: <strong>{client?.email || "Not added"}</strong> · NINO:{" "}
            <strong>{client?.nino || "Not added"}</strong> · UTR:{" "}
            <strong>{client?.utr || "Not added"}</strong>
          </p>

          <p style={styles.subtitle}>
            HMRC:{" "}
            <strong>
              {client?.hmrc_connected ? "Connected" : "Not connected"}
            </strong>{" "}
            · Environment:{" "}
            <strong>{client?.hmrc_environment || "Not set"}</strong> · Income
            source:{" "}
            <strong>{client?.hmrc_income_source_type || "Not set"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <button
            onClick={syncHMRC}
            disabled={syncing || !client}
            style={styles.secondaryButton}
          >
            {syncing ? "Syncing..." : "Sync HMRC"}
          </button>

          <button onClick={openLatestMTDYear} style={styles.primaryButton}>
            Open latest MTD year
          </button>
        </div>
      </div>

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
          <span style={styles.statLabel}>Total profit</span>
          <strong style={styles.statValue}>{money(totals.profit)}</strong>
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
    gap: "12px",
    flexWrap: "wrap",
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
  message: {
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    padding: "14px 16px",
    borderRadius: "14px",
    marginBottom: "20px",
    fontWeight: 700,
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
  },
  sectionTitle: {
    margin: "0 0 18px",
    fontSize: "22px",
    fontWeight: 900,
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