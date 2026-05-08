"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function QuarterWorkspacePage() {
  const params = useParams();
  const router = useRouter();

  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;
  const quarterId = params.quarterId as string;

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarter, setQuarter] = useState<Row | null>(null);
  const [finalWorkflow, setFinalWorkflow] = useState<Row | null>(null);
  const [firmId, setFirmId] = useState("");

  const [income, setIncome] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [status, setStatus] = useState("not_started");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const taxYearIsImmutable = Boolean(
    finalWorkflow?.submitted ||
      finalWorkflow?.locked ||
      finalWorkflow?.is_locked ||
      finalWorkflow?.status === "submitted"
  );

  const money = (value: any) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(Number(value || 0));

  const profit = useMemo(() => {
    return Number(income || 0) - Number(expenses || 0);
  }, [income, expenses]);

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
      router.replace("/auth/login");
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
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: taxYearData, error: taxYearError } = await supabase
      .from("tax_years")
      .select("*")
      .eq("id", taxYearId)
      .eq("client_id", clientId)
      .eq("firm_id", resolvedFirmId)
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
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId)
      .eq("firm_id", resolvedFirmId)
      .maybeSingle();

    if (quarterError || !quarterData) {
      setMessage(quarterError?.message || "Quarter not found.");
      setLoading(false);
      return;
    }

    setQuarter(quarterData);
    setIncome(String(quarterData.income ?? 0));
    setExpenses(String(quarterData.expenses ?? 0));
    setStatus(quarterData.status || "not_started");

    const { data: finalWorkflowData } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    setFinalWorkflow(finalWorkflowData || null);

    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId && quarterId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, taxYearId, quarterId]);

  const saveQuarter = async () => {
    if (taxYearIsImmutable) {
      setMessage(
        "This tax year is locked. Quarter edits are blocked. Start an amendment workflow instead."
      );
      return;
    }

    if (!firmId) {
      setMessage("Firm not resolved. Please refresh and try again.");
      return;
    }

    setSaving(true);
    setMessage("Saving quarter...");

    const incomeNumber = Number(income || 0);
    const expensesNumber = Number(expenses || 0);

    const { data, error } = await supabase
      .from("quarters")
      .update({
        income: incomeNumber,
        expenses: expensesNumber,
        profit: incomeNumber - expensesNumber,
        status,
      })
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId)
      .eq("firm_id", firmId)
      .select("*")
      .maybeSingle();

    if (error) {
      setMessage(`Save error: ${error.message}`);
      setSaving(false);
      return;
    }

    if (!data) {
      setMessage(
        "Save failed: no quarter row was updated. This usually means firm access or RLS blocked the update."
      );
      setSaving(false);
      return;
    }

    setQuarter(data);
    setIncome(String(data.income ?? 0));
    setExpenses(String(data.expenses ?? 0));
    setStatus(data.status || "not_started");

    setMessage("Quarter saved successfully.");
    setSaving(false);
  };

  const markPrepared = async () => {
    if (taxYearIsImmutable) {
      setMessage(
        "This tax year is locked. Quarter edits are blocked. Start an amendment workflow instead."
      );
      return;
    }

    setStatus("prepared");

    if (!firmId) {
      setMessage("Firm not resolved. Please refresh and try again.");
      return;
    }

    setSaving(true);
    setMessage("Marking quarter as prepared...");

    const incomeNumber = Number(income || 0);
    const expensesNumber = Number(expenses || 0);

    const { data, error } = await supabase
      .from("quarters")
      .update({
        income: incomeNumber,
        expenses: expensesNumber,
        profit: incomeNumber - expensesNumber,
        status: "prepared",
        prepared_at: new Date().toISOString(),
      })
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId)
      .eq("firm_id", firmId)
      .select("*")
      .maybeSingle();

    if (error) {
      setMessage(`Prepare error: ${error.message}`);
      setSaving(false);
      return;
    }

    if (!data) {
      setMessage(
        "Prepare failed: no quarter row was updated. This usually means firm access or RLS blocked the update."
      );
      setSaving(false);
      return;
    }

    setQuarter(data);
    setIncome(String(data.income ?? 0));
    setExpenses(String(data.expenses ?? 0));
    setStatus(data.status || "prepared");

    setMessage("Quarter marked as prepared.");
    setSaving(false);
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading quarter workspace...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link
            href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
            style={styles.backLink}
          >
            ← Back to Tax Year Control Centre
          </Link>

          <h1 style={styles.title}>Quarter Workspace</h1>

          <p style={styles.subtitle}>
            Client: <strong>{clientName}</strong> · Tax year:{" "}
            <strong>{taxYear?.year_label}</strong> · Quarter:{" "}
            <strong>{quarter?.quarter_name}</strong>
          </p>

          <p style={styles.subtitle}>
            Period: <strong>{quarter?.start_date}</strong> to{" "}
            <strong>{quarter?.end_date}</strong>
          </p>
        </div>

        <div style={styles.actions}>
          <button onClick={loadData} style={styles.secondaryButton}>
            Refresh
          </button>

          <button
            onClick={saveQuarter}
            disabled={saving || taxYearIsImmutable}
            style={taxYearIsImmutable ? styles.disabledButton : styles.primaryButton}
          >
            {taxYearIsImmutable ? "Locked" : saving ? "Saving..." : "Save Quarter"}
          </button>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {taxYearIsImmutable && (
        <section style={styles.lockBanner}>
          <h2 style={styles.lockTitle}>Tax year locked</h2>
          <p style={styles.lockText}>
            Final Declaration has already been submitted or locked. Quarter edits are
            blocked to preserve the original HMRC submission evidence.
          </p>
          <p style={styles.lockMeta}>
            Use a separate amendment workflow for any post-submission corrections.
          </p>
        </section>
      )}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Income</span>
          <strong style={styles.statValue}>{money(income)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Expenses</span>
          <strong style={styles.statValue}>{money(expenses)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Profit</span>
          <strong style={styles.statValue}>{money(profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Status</span>
          <strong style={styles.statValueSmall}>{status}</strong>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Quarter Figures</h2>

        <div style={styles.formGrid}>
          <label style={styles.label}>
            Income / Turnover
            <input
              type="number"
              value={income}
              disabled={taxYearIsImmutable}
              onChange={(e) => setIncome(e.target.value)}
              style={taxYearIsImmutable ? styles.disabledInput : styles.input}
            />
          </label>

          <label style={styles.label}>
            Allowable Expenses
            <input
              type="number"
              value={expenses}
              disabled={taxYearIsImmutable}
              onChange={(e) => setExpenses(e.target.value)}
              style={taxYearIsImmutable ? styles.disabledInput : styles.input}
            />
          </label>

          <label style={styles.label}>
            Status
            <select
              value={status}
              disabled={taxYearIsImmutable}
              onChange={(e) => setStatus(e.target.value)}
              style={taxYearIsImmutable ? styles.disabledInput : styles.input}
            >
              <option value="not_started">not_started</option>
              <option value="draft">draft</option>
              <option value="prepared">prepared</option>
              <option value="submitted">submitted</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>

        <div style={styles.buttonRow}>
          <button
            onClick={saveQuarter}
            disabled={saving || taxYearIsImmutable}
            style={taxYearIsImmutable ? styles.disabledButton : styles.primaryButton}
          >
            {taxYearIsImmutable ? "Locked" : "Save Quarter"}
          </button>

          <button
            onClick={markPrepared}
            disabled={saving || taxYearIsImmutable}
            style={taxYearIsImmutable ? styles.disabledButton : styles.secondaryButton}
          >
            {taxYearIsImmutable ? "Locked" : "Mark Prepared"}
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>HMRC Submission Readiness</h2>

        <div style={styles.checkList}>
          <div style={styles.checkRow}>
            <span>HMRC connected</span>
            <strong>{client?.hmrc_connected ? "Yes" : "No"}</strong>
          </div>

          <div style={styles.checkRow}>
            <span>Income source</span>
            <strong>{client?.hmrc_income_source_type || "Not set"}</strong>
          </div>

          <div style={styles.checkRow}>
            <span>Obligation linked</span>
            <strong>{quarter?.obligation_id ? "Yes" : "No"}</strong>
          </div>

          <div style={styles.checkRow}>
            <span>Ready to submit</span>
            <strong>{status === "prepared" ? "Yes" : "No"}</strong>
          </div>

          <div style={styles.checkRow}>
            <span>Post-submission edit lock</span>
            <strong>{taxYearIsImmutable ? "Active" : "Not active"}</strong>
          </div>
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
    margin: "0 0 8px",
    fontSize: "15px",
    lineHeight: 1.6,
    fontWeight: 700,
  },
  lockMeta: {
    margin: 0,
    fontSize: "14px",
    color: "#92400e",
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
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 900,
  },
  statValueSmall: {
    fontSize: "18px",
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  label: {
    display: "grid",
    gap: "8px",
    fontWeight: 800,
    color: "#334155",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "15px",
  },
  disabledInput: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "15px",
    background: "#f3f4f6",
    color: "#6b7280",
    cursor: "not-allowed",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
  },
  checkList: {
    display: "grid",
    gap: "12px",
  },
  checkRow: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "10px",
  },
};