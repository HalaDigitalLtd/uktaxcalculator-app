"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

export default function QuarterWorkspacePage() {
  const params = useParams();

  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;
  const quarterId = params.quarterId as string;

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarter, setQuarter] = useState<Row | null>(null);

  const [income, setIncome] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [status, setStatus] = useState("not_started");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    if (quarterError || !quarterData) {
      setMessage(quarterError?.message || "Quarter not found.");
      setLoading(false);
      return;
    }

    setQuarter(quarterData);
    setIncome(String(quarterData.income || quarterData.income_total || 0));
    setExpenses(String(quarterData.expenses || quarterData.expense_total || 0));
    setStatus(quarterData.status || "not_started");

    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId && quarterId) loadData();
  }, [clientId, taxYearId, quarterId]);

  const saveQuarter = async () => {
    setSaving(true);
    setMessage("Saving quarter...");

    const { error } = await supabase
      .from("quarters")
      .update({
        income: Number(income || 0),
        expenses: Number(expenses || 0),
        status,
      })
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId);

    if (error) {
      setMessage(`Save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Quarter saved successfully.");
    setSaving(false);
    await loadData();
  };

  const markPrepared = async () => {
    setStatus("prepared");
    setSaving(true);
    setMessage("Marking quarter as prepared...");

    const { error } = await supabase
      .from("quarters")
      .update({
        income: Number(income || 0),
        expenses: Number(expenses || 0),
        status: "prepared",
      })
      .eq("id", quarterId)
      .eq("tax_year_id", taxYearId);

    if (error) {
      setMessage(`Prepare error: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Quarter marked as prepared.");
    setSaving(false);
    await loadData();
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

          <button onClick={saveQuarter} disabled={saving} style={styles.primaryButton}>
            {saving ? "Saving..." : "Save Quarter"}
          </button>
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

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
              onChange={(e) => setIncome(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Allowable Expenses
            <input
              type="number"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={styles.input}
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
          <button onClick={saveQuarter} disabled={saving} style={styles.primaryButton}>
            Save Quarter
          </button>

          <button onClick={markPrepared} disabled={saving} style={styles.secondaryButton}>
            Mark Prepared
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