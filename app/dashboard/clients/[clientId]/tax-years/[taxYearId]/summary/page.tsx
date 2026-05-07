"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function TaxYearSummaryPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [finalDeclarations, setFinalDeclarations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/auth/login";
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientData) {
      setMessage(clientError?.message || "Client not found.");
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: taxYearData, error: taxYearError } = await supabase
      .from("tax_years")
      .select("*")
      .eq("id", taxYearId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (taxYearError || !taxYearData) {
      setMessage(taxYearError?.message || "Tax year not found.");
      setLoading(false);
      return;
    }

    setTaxYear(taxYearData);

    const { data: quarterData, error: quarterError } = await supabase
      .from("quarters")
      .select("*")
      .eq("tax_year_id", taxYearId)
      .order("start_date", { ascending: true });

    if (quarterError) {
      setMessage(`Quarter load error: ${quarterError.message}`);
      setLoading(false);
      return;
    }

    setQuarters(quarterData || []);

    const { data: fdData } = await supabase
      .from("final_declarations")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: false });

    setFinalDeclarations(fdData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId) loadData();
  }, [clientId, taxYearId]);

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;

    quarters.forEach((q) => {
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
      income,
      expenses,
      profit: income - expenses,
    };
  }, [quarters]);

  const submittedQuarters = useMemo(() => {
  return quarters.filter((q) =>
    [
      "prepared",
      "submitted",
      "finalised",
      "accepted",
    ].includes(String(q.status || "").toLowerCase())
  ).length;
}, [quarters]);

  const latestFinalDeclaration = finalDeclarations[0];

  const finalStatus =
    latestFinalDeclaration?.status ||
    latestFinalDeclaration?.state ||
    latestFinalDeclaration?.declaration_status ||
    "Not started";

  const locked =
    latestFinalDeclaration?.locked === true ||
    latestFinalDeclaration?.is_locked === true ||
    String(latestFinalDeclaration?.status || "").toLowerCase() === "locked" ||
    String(latestFinalDeclaration?.status || "").toLowerCase() === "finalised";

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading tax year control centre...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link
            href={`/dashboard/clients/${clientId}`}
            style={styles.backLink}
          >
            ← Back to client
          </Link>

          <h1 style={styles.title}>Tax Year Control Centre</h1>

          <p style={styles.subtitle}>
            Client: <strong>{clientName}</strong> · Tax year:{" "}
            <strong>{taxYear?.year_label || "Unknown"}</strong>
          </p>

          <p style={styles.subtitle}>
            HMRC:{" "}
            <strong>
              {client?.hmrc_connected ? "Connected" : "Not connected"}
            </strong>{" "}
            · Income source:{" "}
            <strong>{client?.hmrc_income_source_type || "Not set"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <button onClick={loadData} style={styles.secondaryButton}>
            Refresh
          </button>

          <Link
            href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/final-declaration`}
            style={styles.primaryButton}
          >
            Open Final Declaration
          </Link>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual income</span>
          <strong style={styles.statValue}>{money(totals.income)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual expenses</span>
          <strong style={styles.statValue}>{money(totals.expenses)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual profit</span>
          <strong style={styles.statValue}>{money(totals.profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Quarter readiness</span>
          <strong style={styles.statValue}>
            {submittedQuarters}/{quarters.length}
          </strong>
        </div>
      </section>

      <section style={styles.twoCol}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Final Declaration Status</h2>

          <div style={styles.statusBox}>
            <span style={styles.statusLabel}>Current state</span>
            <strong style={styles.statusValue}>{finalStatus}</strong>
          </div>

          <div style={styles.statusGrid}>
            <div>
              <span style={styles.miniLabel}>Lock status</span>
              <strong>{locked ? "Locked" : "Unlocked"}</strong>
            </div>

            <div>
              <span style={styles.miniLabel}>HMRC submission</span>
              <strong>
                {latestFinalDeclaration?.hmrc_submission_id ||
                  latestFinalDeclaration?.submission_id ||
                  "Not submitted"}
              </strong>
            </div>

            <div>
              <span style={styles.miniLabel}>Correlation ID</span>
              <strong>
                {latestFinalDeclaration?.correlation_id || "Not available"}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Readiness Checks</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Client connected to HMRC</span>
              <strong>{client?.hmrc_connected ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Quarter records created</span>
              <strong>{quarters.length > 0 ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>All quarters submitted</span>
              <strong>
                {quarters.length > 0 && submittedQuarters === quarters.length
                  ? "Yes"
                  : "No"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Final declaration locked</span>
              <strong>{locked ? "Yes" : "No"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Quarterly Breakdown</h2>

        {quarters.length === 0 ? (
          <p style={styles.muted}>No quarters found for this tax year.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Quarter</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Income</th>
                  <th style={styles.th}>Expenses</th>
                  <th style={styles.th}>Profit</th>
                  <th style={styles.th}>HMRC obligation</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {quarters.map((q) => {
                  const income = amount(q, [
                    "income",
                    "income_total",
                    "total_income",
                    "turnover",
                    "sales",
                  ]);

                  const expenses = amount(q, [
                    "expenses",
                    "expense_total",
                    "total_expenses",
                    "allowable_expenses",
                  ]);

                  return (
                    <tr key={q.id}>
                      <td style={styles.td}>
                        <strong>{q.quarter_name || "Quarter"}</strong>
                      </td>

                      <td style={styles.td}>
                        {q.start_date || "?"} to {q.end_date || "?"}
                      </td>

                      <td style={styles.td}>
                        <span style={styles.badge}>{q.status || "not_started"}</span>
                      </td>

                      <td style={styles.td}>{money(income)}</td>
                      <td style={styles.td}>{money(expenses)}</td>
                      <td style={styles.td}>
                        <strong>{money(income - expenses)}</strong>
                      </td>

                      <td style={styles.td}>
                        {q.obligation_id ? "Linked" : "None linked"}
                      </td>

                      <td style={styles.td}>
                        <Link
                          href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/quarters/${q.id}`}
                          style={styles.smallButton}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>HMRC Final Declaration History</h2>

        {finalDeclarations.length === 0 ? (
          <p style={styles.muted}>No HMRC final declaration submissions yet.</p>
        ) : (
          <div style={styles.historyList}>
            {finalDeclarations.map((fd) => (
              <div key={fd.id} style={styles.historyCard}>
                <div>
                  <strong>
                    {fd.status ||
                      fd.state ||
                      fd.declaration_status ||
                      "Unknown status"}
                  </strong>
                  <p style={styles.muted}>
                    Created: {fd.created_at || "Not available"}
                  </p>
                </div>

                <div style={styles.historyMeta}>
                  <span>
                    Submission:{" "}
                    {fd.hmrc_submission_id || fd.submission_id || "N/A"}
                  </span>
                  <span>Correlation: {fd.correlation_id || "N/A"}</span>
                </div>
              </div>
            ))}
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
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
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
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "#111827",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    textDecoration: "none",
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
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "20px",
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
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  statusBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "16px",
  },
  statusLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "6px",
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: "22px",
    fontWeight: 900,
  },
  statusGrid: {
    display: "grid",
    gap: "12px",
  },
  miniLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    marginBottom: "4px",
  },
  checkList: {
    display: "grid",
    gap: "12px",
  },
  checkRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "10px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    color: "#64748b",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  badge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 800,
    fontSize: "12px",
  },
  smallButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#2563eb",
    color: "white",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: "10px",
    fontWeight: 800,
  },
  historyList: {
    display: "grid",
    gap: "12px",
  },
  historyCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    background: "#fbfdff",
  },
  historyMeta: {
    display: "grid",
    gap: "4px",
    color: "#334155",
    fontSize: "13px",
  },
};