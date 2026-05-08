"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

export default function AmendmentDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;
  const amendmentId = params.amendmentId as string;

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [amendment, setAmendment] = useState<Row | null>(null);
  const [workflow, setWorkflow] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
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
      client.email ||
      "Client"
    );
  }, [client]);

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

  const originalIncome = Number(amendment?.annual_income_snapshot || 0);
  const originalExpenses = Number(amendment?.annual_expenses_snapshot || 0);
  const originalProfit = Number(amendment?.annual_profit_snapshot || 0);

  const variance = {
    income: totals.income - originalIncome,
    expenses: totals.expenses - originalExpenses,
    profit: totals.profit - originalProfit,
  };

  const amendmentLocked = Boolean(
    amendment?.locked ||
      ["locked", "submitted", "accepted", "hmrc_submitted"].includes(
        normalise(amendment?.status)
      )
  );

  const originalSubmitted = Boolean(
    workflow?.submitted || workflow?.status === "submitted"
  );

  const canEditReason = !amendmentLocked;

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

    const { data: workflowData } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    setWorkflow(workflowData || null);

    const { data: amendmentData, error: amendmentError } = await supabase
      .from("tax_year_amendments")
      .select("*")
      .eq("id", amendmentId)
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    if (amendmentError || !amendmentData) {
      setMessage(amendmentError?.message || "Amendment not found.");
      setLoading(false);
      return;
    }

    setAmendment(amendmentData);

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
    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId && amendmentId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, taxYearId, amendmentId]);

  const updateAmendment = async (payload: Row, successMessage: string) => {
    if (!amendment) return;

    setActionLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("tax_year_amendments")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", amendment.id)
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId);

    if (error) {
      setMessage(error.message);
      setActionLoading(false);
      return;
    }

    setMessage(successMessage);
    await loadData();
    setActionLoading(false);
  };

  const saveReason = async () => {
    if (!amendment) return;

    await updateAmendment(
      {
        reason: amendment.reason || "",
      },
      "Amendment reason saved."
    );
  };

  const changeStatus = async (nextStatus: string) => {
    if (!amendment) return;

    if (!originalSubmitted) {
      setMessage(
        "Original Final Declaration must be submitted before amendment workflow can continue."
      );
      return;
    }

    if (amendmentLocked && nextStatus !== "submitted") {
      setMessage("This amendment is locked. Further changes are blocked.");
      return;
    }

    if (nextStatus === "in_review" && !amendment.reason) {
      setMessage("Please enter an amendment reason before review.");
      return;
    }

    if (nextStatus === "approved" && normalise(amendment.status) !== "in_review") {
      setMessage("Amendment must be in review before approval.");
      return;
    }

    if (nextStatus === "locked" && normalise(amendment.status) !== "approved") {
      setMessage("Amendment must be approved before locking.");
      return;
    }

    await updateAmendment(
      {
        status: nextStatus,
        locked: nextStatus === "locked",
      },
      `Amendment status updated to ${nextStatus.replaceAll("_", " ")}.`
    );
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading amendment...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.backLinks}>
            <Link
              href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
              style={styles.backLink}
            >
              ← Back to tax year summary
            </Link>

            <Link
              href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/final-declaration`}
              style={styles.backLink}
            >
              Back to final declaration
            </Link>
          </div>

          <h1 style={styles.title}>
            Amendment #{amendment?.amendment_number || "-"}
          </h1>

          <p style={styles.subtitle}>
            Client: <strong>{clientName}</strong> · Tax year:{" "}
            <strong>{taxYear?.year_label || "Unknown"}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <button onClick={loadData} style={styles.secondaryButton}>
            Refresh
          </button>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <section style={styles.lockBanner}>
        <h2 style={styles.lockTitle}>Original declaration remains protected</h2>
        <p style={styles.lockText}>
          This amendment workflow is separate from the original Final
          Declaration. Original HMRC submission evidence is preserved and must
          not be overwritten.
        </p>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Original profit</span>
          <strong style={styles.statValue}>{money(originalProfit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Current profit</span>
          <strong style={styles.statValue}>{money(totals.profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Profit variance</span>
          <strong style={variance.profit >= 0 ? styles.passValue : styles.failValue}>
            {money(variance.profit)}
          </strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Status</span>
          <strong style={styles.statValue}>
            {String(amendment?.status || "draft").replaceAll("_", " ")}
          </strong>
        </div>
      </section>

      <section style={styles.twoCol}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Amendment Reason</h2>

          <textarea
            value={amendment?.reason || ""}
            disabled={!canEditReason || actionLoading}
            onChange={(e) =>
              setAmendment((prev) =>
                prev ? { ...prev, reason: e.target.value } : prev
              )
            }
            style={styles.textarea}
            placeholder="Explain why this amendment is required..."
          />

          <div style={styles.actionsRow}>
            <button
              onClick={saveReason}
              disabled={!canEditReason || actionLoading}
              style={!canEditReason ? styles.disabledButton : styles.primaryButton}
            >
              Save Reason
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Original HMRC Evidence</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Original Final Declaration</span>
              <strong style={styles.monospace}>
                {amendment?.original_final_declaration_id || "-"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Original Submission ID</span>
              <strong style={styles.monospace}>
                {amendment?.original_hmrc_submission_id ||
                  workflow?.hmrc_submission_id ||
                  "-"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Original Correlation ID</span>
              <strong style={styles.monospace}>
                {amendment?.original_hmrc_correlation_id ||
                  workflow?.hmrc_correlation_id ||
                  "-"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Original submitted at</span>
              <strong>
                {amendment?.original_submitted_at
                  ? new Date(amendment.original_submitted_at).toLocaleString()
                  : workflow?.hmrc_submitted_at
                  ? new Date(workflow.hmrc_submitted_at).toLocaleString()
                  : "-"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Amendment Workflow Actions</h2>

        <div style={styles.actionGrid}>
          <button
            onClick={() => changeStatus("in_review")}
            disabled={actionLoading || amendmentLocked}
            style={amendmentLocked ? styles.disabledButton : styles.blueButton}
          >
            Submit Amendment for Review
          </button>

          <button
            onClick={() => changeStatus("approved")}
            disabled={actionLoading || amendmentLocked}
            style={amendmentLocked ? styles.disabledButton : styles.greenButton}
          >
            Approve Amendment
          </button>

          <button
            onClick={() => changeStatus("locked")}
            disabled={actionLoading || amendmentLocked}
            style={amendmentLocked ? styles.disabledButton : styles.amberButton}
          >
            Lock Amendment
          </button>

          <button disabled style={styles.disabledButton}>
            HMRC Amendment Submit Coming Next
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Original vs Current Position</h2>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Measure</th>
                <th style={styles.th}>Original snapshot</th>
                <th style={styles.th}>Current records</th>
                <th style={styles.th}>Variance</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={styles.td}>Income</td>
                <td style={styles.td}>{money(originalIncome)}</td>
                <td style={styles.td}>{money(totals.income)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.income)}</strong>
                </td>
              </tr>

              <tr>
                <td style={styles.td}>Expenses</td>
                <td style={styles.td}>{money(originalExpenses)}</td>
                <td style={styles.td}>{money(totals.expenses)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.expenses)}</strong>
                </td>
              </tr>

              <tr>
                <td style={styles.td}>Profit</td>
                <td style={styles.td}>{money(originalProfit)}</td>
                <td style={styles.td}>{money(totals.profit)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.profit)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Quarter Data Reference</h2>

        <p style={styles.muted}>
          For now this page reads current quarter records for reconciliation.
          Original quarter editing remains blocked after final submission. Next
          step will add controlled amendment adjustment records.
        </p>

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
                      <span style={styles.badge}>
                        {q.status || "not_started"}
                      </span>
                    </td>
                    <td style={styles.td}>{money(income)}</td>
                    <td style={styles.td}>{money(expenses)}</td>
                    <td style={styles.td}>
                      <strong>{money(income - expenses)}</strong>
                    </td>
                  </tr>
                );
              })}

              {quarters.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={6}>
                    No quarters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  backLinks: {
    display: "flex",
    gap: "14px",
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
    gap: "12px",
    flexWrap: "wrap",
  },
  actionsRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "14px",
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
  disabledButton: {
    border: "1px solid #d1d5db",
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 900,
    cursor: "not-allowed",
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
  lockBanner: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    color: "#78350f",
    padding: "20px",
    borderRadius: "18px",
    marginBottom: "20px",
    boxShadow: "0 10px 25px rgba(146, 64, 14, 0.08)",
  },
  lockTitle: {
    margin: "0 0 8px",
    fontSize: "22px",
    fontWeight: 900,
  },
  lockText: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.6,
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
  passValue: {
    fontSize: "24px",
    fontWeight: 900,
    color: "#15803d",
  },
  failValue: {
    fontSize: "24px",
    fontWeight: 900,
    color: "#b91c1c",
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
    margin: "0 0 16px",
    color: "#64748b",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    minHeight: "150px",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
  },
  checkList: {
    display: "grid",
    gap: "12px",
  },
  checkRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "10px",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
  },
  blueButton: {
    border: "none",
    background: "#2563eb",
    color: "white",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  greenButton: {
    border: "none",
    background: "#16a34a",
    color: "white",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  amberButton: {
    border: "none",
    background: "#b45309",
    color: "white",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
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
  monospace: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },
};