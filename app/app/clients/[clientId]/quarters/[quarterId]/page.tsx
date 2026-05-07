"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { supabase } from "../../../../../../lib/supabaseClient";

const categoryOptions = [
  { value: "turnover", label: "Turnover / Sales", type: "income" },
  { value: "other_income", label: "Other Income", type: "income" },
  { value: "cost_of_goods", label: "Cost of Goods", type: "expense" },
  { value: "rent", label: "Rent", type: "expense" },
  { value: "utilities", label: "Utilities", type: "expense" },
  { value: "software", label: "Software", type: "expense" },
  { value: "travel", label: "Travel", type: "expense" },
  { value: "motor_expenses", label: "Motor Expenses", type: "expense" },
  { value: "office_costs", label: "Office Costs", type: "expense" },
  { value: "advertising", label: "Advertising / Marketing", type: "expense" },
  { value: "professional_fees", label: "Professional Fees", type: "expense" },
  { value: "insurance", label: "Insurance", type: "expense" },
  { value: "repairs", label: "Repairs & Maintenance", type: "expense" },
  { value: "bank_charges", label: "Bank Charges", type: "expense" },
  { value: "wages", label: "Wages", type: "expense" },
  { value: "other_expenses", label: "Other Expenses", type: "expense" },
];

const allowedCategories = categoryOptions.map((c) => c.value);
const allowedTypes = ["income", "expense"];

const normalizeText = (value: string) =>
  String(value || "").toLowerCase().trim().replaceAll("-", " ").replaceAll("_", " ");

const mapCategory = (rawCategory: string, description: string, type: string) => {
  const text = `${normalizeText(rawCategory)} ${normalizeText(description)}`;

  if (type === "income") {
    if (
      text.includes("sale") ||
      text.includes("sales") ||
      text.includes("turnover") ||
      text.includes("income") ||
      text.includes("revenue")
    ) {
      return "turnover";
    }

    return "other_income";
  }

  if (text.includes("stock") || text.includes("goods") || text.includes("purchases") || text.includes("materials")) return "cost_of_goods";
  if (text.includes("rent")) return "rent";
  if (text.includes("electric") || text.includes("gas") || text.includes("water") || text.includes("utility") || text.includes("utilities")) return "utilities";
  if (text.includes("xero") || text.includes("quickbooks") || text.includes("software") || text.includes("subscription") || text.includes("saas") || text.includes("microsoft") || text.includes("google workspace")) return "software";
  if (text.includes("train") || text.includes("bus") || text.includes("uber") || text.includes("taxi") || text.includes("hotel") || text.includes("travel")) return "travel";
  if (text.includes("fuel") || text.includes("petrol") || text.includes("diesel") || text.includes("parking") || text.includes("motor") || text.includes("vehicle") || text.includes("car")) return "motor_expenses";
  if (text.includes("office") || text.includes("stationery") || text.includes("paper") || text.includes("printer") || text.includes("postage") || text.includes("supplies")) return "office_costs";
  if (text.includes("ads") || text.includes("advert") || text.includes("marketing") || text.includes("facebook") || text.includes("meta") || text.includes("google ads") || text.includes("linkedin")) return "advertising";
  if (text.includes("accountant") || text.includes("legal") || text.includes("solicitor") || text.includes("consultant") || text.includes("professional")) return "professional_fees";
  if (text.includes("insurance")) return "insurance";
  if (text.includes("repair") || text.includes("maintenance") || text.includes("fix")) return "repairs";
  if (text.includes("bank") || text.includes("charge") || text.includes("charges") || text.includes("stripe") || text.includes("paypal")) return "bank_charges";
  if (text.includes("wage") || text.includes("salary") || text.includes("payroll") || text.includes("staff")) return "wages";

  return "other_expenses";
};

const formatCategory = (value: string) => {
  if (!value) return "";
  const found = categoryOptions.find((c) => c.value === value);
  return found ? found.label : value.replaceAll("_", " ");
};

export default function QuarterDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const quarterId = params.quarterId as string;

  const [quarter, setQuarter] = useState<any>(null);
  const [linkedObligations, setLinkedObligations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);

  const [type, setType] = useState("income");
  const [category, setCategory] = useState("turnover");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: quarterData, error: quarterError } = await supabase
      .from("quarters")
      .select("*")
      .eq("id", quarterId)
      .single();

    if (quarterError || !quarterData) {
      alert(quarterError?.message || "Quarter not found.");
      setLoading(false);
      return;
    }

    setQuarter(quarterData);

    const { data: linkData } = await supabase
      .from("quarter_obligations")
      .select("obligation_id")
      .eq("quarter_id", quarterId);

    const obligationIds = [
      ...(linkData || []).map((l: any) => l.obligation_id),
      ...(quarterData.obligation_id ? [quarterData.obligation_id] : []),
    ];

    const uniqueObligationIds = Array.from(new Set(obligationIds));

    if (uniqueObligationIds.length > 0) {
      const { data: obligationsData } = await supabase
        .from("obligations")
        .select("*")
        .in("id", uniqueObligationIds)
        .order("hmrc_source", { ascending: true });

      setLinkedObligations(obligationsData || []);
    } else {
      setLinkedObligations([]);
    }

    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .eq("quarter_id", quarterId)
      .order("date", { ascending: false });

    setTransactions(transactionsData || []);

    const { data: submissionsData } = await supabase
      .from("submissions")
      .select("*")
      .eq("quarter_id", quarterId)
      .order("submitted_at", { ascending: false });

    setSubmissions(submissionsData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (quarterId) loadData();
  }, [quarterId]);

  const incomeTransactions = transactions.filter((t) => t.type === "income");
  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  const isSubmitted = quarter?.status === "submitted";
  const isBusy = submitting || retryingFailed;

  const earliestDueDate = useMemo(() => {
    const dates = linkedObligations.map((o) => o.due_date).filter(Boolean).sort();
    return dates[0] || "";
  }, [linkedObligations]);

  const downloadTemplate = () => {
    const csv = `type,category,amount,date,description
income,turnover,5000,2026-04-10,Sales income
expense,office cost,85.50,2026-04-12,Stationery and office supplies
expense,fuel,60.00,2026-04-15,Fuel for business travel
expense,software,35.00,2026-04-18,Xero subscription
expense,accountancy,250.00,2026-04-20,Accountancy fees`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "mtd_transactions_template.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitted) {
      alert("This quarter is submitted and locked.");
      return;
    }

    const finalCategory = category || mapCategory("", description, type);

    const { error } = await supabase.from("transactions").insert({
      quarter_id: quarterId,
      type,
      category: finalCategory,
      amount: Number(amount),
      date,
      description,
    });

    if (error) return alert(error.message);

    setType("income");
    setCategory("turnover");
    setAmount("");
    setDate("");
    setDescription("");

    loadData();
  };

  const handleCSVUpload = async (e: any) => {
    if (isSubmitted) {
      alert("This quarter is submitted and locked.");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results: any) {
        const rows = results.data;
        const validRows: any[] = [];
        const skippedRows: string[] = [];
        const mappedRows: string[] = [];

        rows.forEach((row: any, index: number) => {
          const rowNumber = index + 2;
          const cleanType = normalizeText(row.type);
          const rawCategory = String(row.category || "").trim();
          const cleanAmount = Number(row.amount);
          const cleanDate = String(row.date || "").trim();
          const cleanDescription = String(row.description || "").trim();

          if (!allowedTypes.includes(cleanType)) {
            skippedRows.push(`Row ${rowNumber}: invalid type "${row.type}"`);
            return;
          }

          if (!cleanAmount || cleanAmount <= 0) {
            skippedRows.push(`Row ${rowNumber}: invalid amount "${row.amount}"`);
            return;
          }

          if (!cleanDate) {
            skippedRows.push(`Row ${rowNumber}: missing date`);
            return;
          }

          const finalCategory = allowedCategories.includes(rawCategory)
            ? rawCategory
            : mapCategory(rawCategory, cleanDescription, cleanType);

          if (rawCategory && rawCategory !== finalCategory) {
            mappedRows.push(
              `Row ${rowNumber}: "${rawCategory}" mapped to "${formatCategory(finalCategory)}"`
            );
          }

          validRows.push({
            quarter_id: quarterId,
            type: cleanType,
            category: finalCategory,
            amount: cleanAmount,
            date: cleanDate,
            description: cleanDescription,
          });
        });

        if (validRows.length === 0) {
          alert(`No valid rows found.\n\n${skippedRows.slice(0, 10).join("\n")}`);
          e.target.value = "";
          return;
        }

        const { error } = await supabase.from("transactions").insert(validRows);

        if (error) {
          alert(error.message);
          e.target.value = "";
          return;
        }

        await loadData();

        setImportSummary(
          `${validRows.length} transactions imported. ${skippedRows.length} rows skipped. ${mappedRows.length} categories auto-mapped.`
        );

        alert(
          `CSV uploaded.\n\nImported: ${validRows.length}\nSkipped: ${skippedRows.length}\nAuto-mapped: ${mappedRows.length}`
        );

        e.target.value = "";
      },
    });
  };

  const deleteTransaction = async (id: string) => {
    if (isSubmitted) {
      alert("This quarter is submitted and locked.");
      return;
    }

    if (!confirm("Are you sure you want to delete this transaction?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return alert(error.message);

    loadData();
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("quarters").update({ status }).eq("id", quarterId);
    if (error) return alert(error.message);

    if (linkedObligations.length > 0) {
      await supabase
        .from("obligations")
        .update({ status: status === "submitted" ? "fulfilled" : "open" })
        .in("id", linkedObligations.map((o) => o.id));
    }

    loadData();
  };

  const submitToHMRC = async (retryFailedOnly = false) => {
    try {
      if (isSubmitted && !retryFailedOnly) return alert("Already submitted.");
      if (transactions.length === 0) return alert("No transactions to submit.");
      if (linkedObligations.length === 0) return alert("No HMRC obligations linked to this quarter.");

      const confirmMessage = retryFailedOnly
        ? "Retry failed HMRC obligations only?\n\nPreviously successful obligations will be skipped to avoid duplicate submissions."
        : "Submit this quarter to HMRC now?\n\nThis will create a real HMRC submission attempt and save an audit trail.";

      if (!confirm(confirmMessage)) return;

      if (retryFailedOnly) {
        setRetryingFailed(true);
      } else {
        setSubmitting(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Not authenticated.");
        return;
      }

      const response = await fetch("/api/hmrc/submit-quarter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quarterId,
          is_retry: retryFailedOnly,
          retry_failed_only: retryFailedOnly,
        }),
      });

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: "Non-JSON response received from server.", raw: text };
      }

      if (!response.ok) {
        console.error(data);
        alert(data.error || "HMRC submission failed.");
        return;
      }

      await loadData();

      const resultLines = (data.hmrcResults || [])
        .map((r: any, index: number) => {
          const statusText = r.skipped ? "SKIPPED" : r.success ? "SUCCESS" : "FAILED";

          return `${index + 1}. ${r.businessType || "obligation"}: ${statusText}${
            r.statusCode ? ` (${r.statusCode})` : ""
          }${r.correlationId ? `\nCorrelation ID: ${r.correlationId}` : ""}${
            r.errorMessage ? `\nNote/Error: ${r.errorMessage}` : ""
          }`;
        })
        .join("\n\n");

      alert(
        `${data.message}\n\nObligations: ${data.obligationCount}\nAttempted: ${
          data.attemptedCount ?? "N/A"
        }\nSkipped: ${data.skippedCount ?? 0}\nIncome: £${Number(data.totalIncome).toFixed(
          2
        )}\nExpenses: £${Number(data.totalExpenses).toFixed(2)}\nNet Profit: £${Number(
          data.netProfit
        ).toFixed(2)}\n\n${resultLines}`
      );
    } catch (error) {
      console.error(error);
      alert("Unexpected error submitting to HMRC.");
    } finally {
      setSubmitting(false);
      setRetryingFailed(false);
    }
  };

  const formatDateTime = (value: string) => {
    if (!value) return "";
    return new Date(value).toLocaleString("en-GB");
  };

  const formatDate = (value: string) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-GB");
  };

  const prettySource = (source: string) => {
    if (!source) return "Manual";
    return source.replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const statusBadge = (status: string) => (
    <span style={badgeStyle}>{(status || "").replaceAll("_", " ")}</span>
  );

  if (loading || !quarter) {
    return (
      <div style={{ padding: 40, background: "#f6f8fb", minHeight: "100vh" }}>
        Loading quarter...
      </div>
    );
  }

  return (
    <div style={{ padding: 40, background: "#f6f8fb", minHeight: "100vh" }}>
      <a href={`/app/clients/${clientId}`} style={backLink}>
        ← Back to client
      </a>

      <h1 style={{ marginTop: 0 }}>Quarter Workspace</h1>

      <section style={sectionStyle}>
        <h2>
          {quarter?.quarter_label || quarter?.quarter_name} {statusBadge(quarter?.status)}
        </h2>

        <p>
          <strong>Period:</strong> {formatDate(quarter.start_date)} to {formatDate(quarter.end_date)}
        </p>

        <p>
          <strong>Earliest due date:</strong> {earliestDueDate ? formatDate(earliestDueDate) : "No due date"}
        </p>

        <h3>Linked HMRC Obligations</h3>

        {linkedObligations.length === 0 ? (
          <p style={{ color: "#dc2626", fontWeight: 700 }}>No HMRC obligations linked to this quarter.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {linkedObligations.map((o) => (
              <div key={o.id} style={miniCard}>
                <strong>{prettySource(o.hmrc_source)}</strong>
                <p style={{ margin: "6px 0" }}>{o.period_key}</p>
                <p style={{ margin: 0 }}>
                  {formatDate(o.start_date)} to {formatDate(o.end_date)} · Due{" "}
                  <strong>{formatDate(o.due_date)}</strong> · {o.status}
                </p>
              </div>
            ))}
          </div>
        )}

        {isSubmitted && (
          <p style={{ color: "red", fontWeight: "bold" }}>
            This quarter has been fully submitted and is locked.
          </p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Workflow Status</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["not_started", "in_progress", "ready_for_review", "client_approved", "submitted"].map((status) => (
            <button key={status} onClick={() => updateStatus(status)} style={buttonStyle}>
              {status.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Add Transaction</h2>

        <form onSubmit={addTransaction} style={{ display: "grid", gap: 12, maxWidth: 500 }}>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={isSubmitted} style={inputStyle}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isSubmitted} required style={inputStyle}>
            <option value="">Auto-detect / Select category</option>
            <optgroup label="Income">
              {categoryOptions.filter((c) => c.type === "income").map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Expenses">
              {categoryOptions.filter((c) => c.type === "expense").map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </optgroup>
          </select>

          <input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={isSubmitted} required style={inputStyle} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitted} required style={inputStyle} />
          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitted} style={inputStyle} />

          <button type="submit" disabled={isSubmitted} style={buttonStyle}>
            Add Transaction
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2>Upload CSV</h2>

        <button onClick={downloadTemplate} disabled={isSubmitted} style={buttonStyle}>
          Download CSV Template
        </button>

        <div style={infoBox}>
          <p><strong>CSV columns required:</strong></p>
          <p><code>type, category, amount, date, description</code></p>
          <p><strong>Type:</strong> income or expense</p>
          <p><strong>Date format:</strong> YYYY-MM-DD</p>
          <p><strong>Categories:</strong> optional. Unknown categories will be auto-mapped.</p>
        </div>

        {importSummary && <p style={{ color: "#166534", fontWeight: 700 }}>{importSummary}</p>}

        <input type="file" accept=".csv" onChange={handleCSVUpload} disabled={isSubmitted} />
      </section>

      <section style={sectionStyle}>
        <h2>Submission Summary</h2>

        <div style={miniCard}>
          <p><strong>Total Income:</strong> £{totalIncome.toFixed(2)}</p>
          <p><strong>Total Expenses:</strong> £{totalExpenses.toFixed(2)}</p>
          <p><strong>Net Profit:</strong> £{netProfit.toFixed(2)}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              onClick={() => submitToHMRC(false)}
              disabled={isSubmitted || isBusy}
              style={{
                ...buttonStyle,
                background: isSubmitted || isBusy ? "#cbd5e1" : "#16a34a",
              }}
            >
              {submitting ? "Submitting to HMRC..." : "Submit to HMRC"}
            </button>

            <button
              onClick={() => submitToHMRC(true)}
              disabled={isBusy}
              style={{
                ...buttonStyle,
                background: isBusy ? "#cbd5e1" : "#f97316",
              }}
            >
              {retryingFailed ? "Retrying Failed..." : "Retry Failed Only"}
            </button>
          </div>

          <p style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
            Retry Failed Only skips obligations already successfully submitted, avoiding duplicate HMRC submissions.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Submission History</h2>

        {submissions.length === 0 ? (
          <p>No submissions yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {submissions.map((s) => {
              const results = s.hmrc_response_payload || s.hmrc_response || [];
              const resultArray = Array.isArray(results) ? results : [];

              return (
                <div key={s.id} style={miniCard}>
                  <p><strong>Submitted At:</strong> {formatDateTime(s.submitted_at)}</p>
                  <p><strong>Status:</strong> {s.status}</p>
                  <p><strong>HMRC Status:</strong> {s.hmrc_status || "not_sent"}</p>
                  <p><strong>Total Income:</strong> £{Number(s.total_income || 0).toFixed(2)}</p>
                  <p><strong>Total Expenses:</strong> £{Number(s.total_expenses || 0).toFixed(2)}</p>
                  <p><strong>Net Profit:</strong> £{Number(s.net_profit || 0).toFixed(2)}</p>

                  {s.hmrc_correlation_id && (
                    <p><strong>Correlation ID:</strong> <code>{s.hmrc_correlation_id}</code></p>
                  )}

                  {s.hmrc_error_message && (
                    <p style={{ color: "#dc2626" }}>
                      <strong>Error:</strong> {s.hmrc_error_message}
                    </p>
                  )}

                  {resultArray.length > 0 && (
                    <>
                      <h4>Obligation Results</h4>
                      <div style={{ display: "grid", gap: 8 }}>
                        {resultArray.map((r: any, index: number) => (
                          <div key={index} style={resultBox(r.success, r.skipped)}>
                            <p style={{ margin: 0 }}>
                              <strong>{r.businessType || "Obligation"}</strong> ·{" "}
                              {r.skipped ? "Skipped" : r.success ? "Success" : "Failed"} · Status {r.statusCode || "N/A"}
                            </p>
                            {r.correlationId && (
                              <p style={{ margin: "6px 0 0" }}>
                                Correlation ID: <code>{r.correlationId}</code>
                              </p>
                            )}
                            {r.hmrcSubmissionId && (
                              <p style={{ margin: "6px 0 0" }}>
                                HMRC Submission ID: <code>{r.hmrcSubmissionId}</code>
                              </p>
                            )}
                            {r.errorMessage && (
                              <p style={{ margin: "6px 0 0", color: r.skipped ? "#475569" : "#dc2626" }}>
                                {r.errorMessage}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Income</h2>
        {renderTransactions(incomeTransactions, isSubmitted, deleteTransaction)}

        <h2>Expenses</h2>
        {renderTransactions(expenseTransactions, isSubmitted, deleteTransaction)}
      </section>
    </div>
  );
}

function renderTransactions(rows: any[], isSubmitted: boolean, deleteTransaction: any) {
  if (rows.length === 0) return <p>No transactions yet.</p>;

  return (
    <table cellPadding={10} style={tableStyle}>
      <thead>
        <tr>
          <th align="left">Date</th>
          <th align="left">Category</th>
          <th align="left">Description</th>
          <th align="left">Amount</th>
          <th align="left">Action</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((t) => (
          <tr key={t.id}>
            <td>{t.date}</td>
            <td>{formatCategory(t.category)}</td>
            <td>{t.description}</td>
            <td>£{Number(t.amount).toFixed(2)}</td>
            <td>
              <button onClick={() => deleteTransaction(t.id)} disabled={isSubmitted}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const resultBox = (success: boolean, skipped = false) => ({
  border: `1px solid ${skipped ? "#cbd5e1" : success ? "#86efac" : "#fecaca"}`,
  borderRadius: 10,
  padding: 10,
  background: skipped ? "#f8fafc" : success ? "#f0fdf4" : "#fef2f2",
});

const sectionStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const miniCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#f8fafc",
};

const infoBox = {
  background: "#f8fafc",
  padding: 15,
  marginTop: 15,
  marginBottom: 15,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
};

const inputStyle = {
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
};

const buttonStyle = {
  background: "#0f172a",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const badgeStyle = {
  display: "inline-flex",
  marginLeft: 8,
  padding: "5px 10px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 800,
  fontSize: 13,
};

const backLink = {
  color: "#2563eb",
  textDecoration: "none",
  display: "inline-block",
  marginBottom: 20,
  fontWeight: 600,
};

const tableStyle = {
  borderCollapse: "collapse" as const,
  width: "100%",
  background: "white",
};