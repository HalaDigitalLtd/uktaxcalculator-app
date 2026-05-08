"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";
import { authenticatedFetch } from "../../../../../../../../lib/authenticatedFetch";

type Row = Record<string, any>;

type AdjustmentForm = {
  adjustment_type: "income" | "expense";
  direction: "increase" | "decrease";
  category: string;
  amount: string;
  description: string;
  reason: string;
  quarter_id: string;
};

const emptyAdjustmentForm: AdjustmentForm = {
  adjustment_type: "income",
  direction: "increase",
  category: "",
  amount: "",
  description: "",
  reason: "",
  quarter_id: "",
};

function n(value: any) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

function money(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n(value));
}

function pickNumber(row: any, keys: string[]) {
  if (!row) return 0;
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return n(row[key]);
    }
  }
  return 0;
}

function signedAdjustment(row: Row) {
  return row.direction === "decrease" ? -n(row.amount) : n(row.amount);
}

function formatDate(value: any) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return "-";
  }
}

function quarterLabel(q: Row) {
  const start =
    q.period_start ||
    q.periodStartDate ||
    q.period_start_date ||
    q.start_date ||
    q.from_date ||
    "Start";

  const end =
    q.period_end ||
    q.periodEndDate ||
    q.period_end_date ||
    q.end_date ||
    q.to_date ||
    "End";

  return `${start} to ${end}`;
}

function statusClass(status: any) {
  const s = String(status || "draft").toLowerCase();
  if (s.includes("submitted")) return "status green";
  if (s.includes("locked")) return "status blue";
  if (s.includes("approved")) return "status purple";
  if (s.includes("review")) return "status amber";
  if (s.includes("failed")) return "status red";
  return "status grey";
}

export default function AmendmentDetailPage() {
  const params = useParams();

  const clientId = String(params.clientId || "");
  const taxYearId = String(params.taxYearId || "");
  const amendmentId = String(params.amendmentId || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<Row | null>(null);
  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [amendment, setAmendment] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [adjustments, setAdjustments] = useState<Row[]>([]);
  const [auditTrail, setAuditTrail] = useState<Row[]>([]);

  const [form, setForm] = useState<AdjustmentForm>(emptyAdjustmentForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function writeAudit(action: string, details: Row = {}) {
    try {
      await supabase.from("hmrc_submission_logs").insert({
        client_id: clientId,
        tax_year_id: taxYearId,
        amendment_id: amendmentId,
        action,
        status: details.status || "success",
        message: details.message || action,
        meta: {
          amendment_id: amendmentId,
          client_id: clientId,
          tax_year_id: taxYearId,
          action,
          ...details,
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Audit write failed", e);
    }
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getUser();
      setUser(sessionData?.user || null);

      const [
        amendmentRes,
        clientRes,
        taxYearRes,
        quartersRes,
        adjustmentsRes,
        auditRes,
      ] = await Promise.all([
        supabase
          .from("tax_year_amendments")
          .select("*")
          .eq("id", amendmentId)
          .maybeSingle(),

        supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),

        supabase.from("tax_years").select("*").eq("id", taxYearId).maybeSingle(),

        supabase.from("quarters").select("*").eq("tax_year_id", taxYearId),

        supabase
          .from("tax_year_amendment_adjustments")
          .select("*")
          .eq("amendment_id", amendmentId)
          .order("created_at", { ascending: false }),

        supabase
          .from("hmrc_submission_logs")
          .select("*")
          .filter("meta->>amendment_id", "eq", amendmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (amendmentRes.error) throw amendmentRes.error;
      if (clientRes.error) throw clientRes.error;
      if (taxYearRes.error) throw taxYearRes.error;
      if (quartersRes.error) throw quartersRes.error;
      if (adjustmentsRes.error) throw adjustmentsRes.error;
      if (auditRes.error) throw auditRes.error;

      setAmendment(amendmentRes.data);
      setClient(clientRes.data);
      setTaxYear(taxYearRes.data);
      setQuarters(quartersRes.data || []);
      setAdjustments(adjustmentsRes.data || []);
      setAuditTrail(auditRes.data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load amendment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId && taxYearId && amendmentId) loadData();
  }, [clientId, taxYearId, amendmentId]);

  const activeAdjustments = useMemo(
    () => adjustments.filter((x) => x.status !== "void"),
    [adjustments]
  );

  const originalTotals = useMemo(() => {
    const meta = amendment?.meta || {};

    const income =
      pickNumber(amendment, [
        "original_total_income",
        "original_income",
        "locked_original_income",
        "snapshot_total_income",
      ]) ||
      pickNumber(meta, [
        "original_total_income",
        "original_income",
        "total_income",
        "income",
      ]);

    const expenses =
      pickNumber(amendment, [
        "original_total_expenses",
        "original_expenses",
        "locked_original_expenses",
        "snapshot_total_expenses",
      ]) ||
      pickNumber(meta, [
        "original_total_expenses",
        "original_expenses",
        "total_expenses",
        "expenses",
      ]);

    return { income, expenses, profit: income - expenses };
  }, [amendment]);

  const adjustmentTotals = useMemo(() => {
    let income = 0;
    let expenses = 0;

    for (const row of activeAdjustments) {
      const signed = signedAdjustment(row);
      if (row.adjustment_type === "income") income += signed;
      if (row.adjustment_type === "expense") expenses += signed;
    }

    return { income, expenses, profit: income - expenses };
  }, [activeAdjustments]);

  const amendedTotals = useMemo(() => {
    const income = originalTotals.income + adjustmentTotals.income;
    const expenses = originalTotals.expenses + adjustmentTotals.expenses;
    return { income, expenses, profit: income - expenses };
  }, [originalTotals, adjustmentTotals]);

  const isLocked = Boolean(amendment?.locked || amendment?.locked_at);
  const isSubmitted = Boolean(
    amendment?.submitted_at ||
      amendment?.hmrc_submission_id ||
      amendment?.hmrc_amendment_id ||
      String(amendment?.status || "").toLowerCase() === "submitted"
  );

  async function addAdjustment() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const amount = Number(form.amount);

      if (isLocked) throw new Error("This amendment is locked.");
      if (!amount || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount.");
      }
      if (!form.description.trim()) throw new Error("Description is required.");
      if (!form.reason.trim()) throw new Error("Reason is required.");

      const { error: insertError } = await supabase
        .from("tax_year_amendment_adjustments")
        .insert({
          client_id: clientId,
          tax_year_id: taxYearId,
          amendment_id: amendmentId,
          quarter_id: form.quarter_id || null,
          adjustment_type: form.adjustment_type,
          direction: form.direction,
          category: form.category || null,
          amount,
          description: form.description.trim(),
          reason: form.reason.trim(),
          source: "manual_adjustment",
          status: "active",
          created_by: user?.id || null,
          created_by_email: user?.email || null,
          meta: {
            amendment_id: amendmentId,
            client_id: clientId,
            tax_year_id: taxYearId,
            quarter_id: form.quarter_id || null,
            compliance_note:
              "Internal digital working paper adjustment. HMRC receives controlled summary totals only.",
          },
        });

      if (insertError) throw insertError;

      await writeAudit("amendment_adjustment_added", {
        message: "Adjustment added to amendment ledger.",
        amount,
        adjustment_type: form.adjustment_type,
        direction: form.direction,
        category: form.category,
        reason: form.reason,
      });

      setForm(emptyAdjustmentForm);
      setMessage("Adjustment added successfully.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to add adjustment.");
    } finally {
      setSaving(false);
    }
  }

  async function voidAdjustment(row: Row) {
    const reason = window.prompt("Reason for voiding this adjustment?");
    if (!reason) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (isLocked) throw new Error("Unlock amendment before voiding adjustment.");

      const { error: updateError } = await supabase
        .from("tax_year_amendment_adjustments")
        .update({
          status: "void",
          voided_by: user?.id || null,
          voided_by_email: user?.email || null,
          voided_at: new Date().toISOString(),
          void_reason: reason,
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

      await writeAudit("amendment_adjustment_voided", {
        message: "Adjustment voided.",
        adjustment_id: row.id,
        reason,
      });

      setMessage("Adjustment voided.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to void adjustment.");
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (activeAdjustments.length === 0) {
        throw new Error("Add at least one adjustment before review.");
      }

      const { error: updateError } = await supabase
        .from("tax_year_amendments")
        .update({
          status: "submitted_for_review",
          submitted_for_review_at: new Date().toISOString(),
          submitted_for_review_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", amendmentId);

      if (updateError) throw updateError;

      await writeAudit("amendment_submitted_for_review", {
        message: "Amendment submitted for accountant review.",
        originalTotals,
        adjustmentTotals,
        amendedTotals,
      });

      setMessage("Submitted for accountant review.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to submit for review.");
    } finally {
      setSaving(false);
    }
  }

  async function approveAmendment() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("tax_year_amendments")
        .update({
          status: "approved",
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", amendmentId);

      if (updateError) throw updateError;

      await writeAudit("amendment_approved", {
        message: "Amendment approved by accountant.",
        originalTotals,
        adjustmentTotals,
        amendedTotals,
      });

      setMessage("Amendment approved.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to approve amendment.");
    } finally {
      setSaving(false);
    }
  }

  async function lockAmendment() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (activeAdjustments.length === 0) {
        throw new Error("Cannot lock without adjustment ledger entries.");
      }

      const { error: updateError } = await supabase
        .from("tax_year_amendments")
        .update({
          status: "locked",
          locked: true,
          locked_at: new Date().toISOString(),
          locked_by: user?.id || null,

          locked_original_income: originalTotals.income,
          locked_original_expenses: originalTotals.expenses,
          locked_original_profit: originalTotals.profit,

          locked_adjustment_income: adjustmentTotals.income,
          locked_adjustment_expenses: adjustmentTotals.expenses,
          locked_adjustment_profit: adjustmentTotals.profit,

          locked_amended_income: amendedTotals.income,
          locked_amended_expenses: amendedTotals.expenses,
          locked_amended_profit: amendedTotals.profit,

          variance_income: adjustmentTotals.income,
          variance_expenses: adjustmentTotals.expenses,
          variance_profit: adjustmentTotals.profit,

          updated_at: new Date().toISOString(),
        })
        .eq("id", amendmentId);

      if (updateError) throw updateError;

      await writeAudit("amendment_locked", {
        message: "Amendment locked from adjustment ledger.",
        originalTotals,
        adjustmentTotals,
        amendedTotals,
      });

      setMessage("Amendment locked. Totals are now frozen.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to lock amendment.");
    } finally {
      setSaving(false);
    }
  }

  async function unlockAmendment() {
    const reason = window.prompt("Reason for unlocking amendment?");
    if (!reason) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (isSubmitted) throw new Error("Submitted amendment cannot be unlocked.");

      const { error: updateError } = await supabase
        .from("tax_year_amendments")
        .update({
          status: "unlocked",
          locked: false,
          unlocked_at: new Date().toISOString(),
          unlocked_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", amendmentId);

      if (updateError) throw updateError;

      await writeAudit("amendment_unlocked", {
        message: "Amendment unlocked.",
        reason,
      });

      setMessage("Amendment unlocked.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to unlock amendment.");
    } finally {
      setSaving(false);
    }
  }

  async function submitHmrcAmendment() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!isLocked) throw new Error("Lock amendment before HMRC submission.");
      if (isSubmitted) throw new Error("Duplicate submission blocked.");

      const lockedIncome =
        pickNumber(amendment, ["locked_amended_income"]) || amendedTotals.income;
      const lockedExpenses =
        pickNumber(amendment, ["locked_amended_expenses"]) ||
        amendedTotals.expenses;
      const lockedProfit =
        pickNumber(amendment, ["locked_amended_profit"]) ||
        lockedIncome - lockedExpenses;

      await writeAudit("amendment_hmrc_submission_started", {
        message: "HMRC amendment submission started.",
        lockedTotals: {
          income: lockedIncome,
          expenses: lockedExpenses,
          profit: lockedProfit,
        },
      });

      const res = await authenticatedFetch("/api/hmrc/submit-amendment", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          taxYearId,
          amendmentId,
          totals: {
            income: lockedIncome,
            expenses: lockedExpenses,
            profit: lockedProfit,
          },
          source: "locked_amendment_ledger",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        await writeAudit("amendment_hmrc_submission_failed", {
          status: "failed",
          message: json.error || "HMRC amendment submission failed.",
          response: json,
        });

        await supabase
          .from("tax_year_amendments")
          .update({
            last_error: json.error || "HMRC amendment submission failed.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", amendmentId);

        throw new Error(json.error || "HMRC amendment submission failed.");
      }

      const submittedAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("tax_year_amendments")
        .update({
          status: "submitted",
          submitted_at: submittedAt,
          submitted_by: user?.id || null,
          submitted_income: lockedIncome,
          submitted_expenses: lockedExpenses,
          submitted_profit: lockedProfit,
          hmrc_submission_id:
            json.hmrcSubmissionId ||
            json.submissionId ||
            json.internalSubmissionId ||
            null,
          hmrc_amendment_id:
            json.hmrcAmendmentId ||
            json.amendmentId ||
            json.internalAmendmentId ||
            null,
          hmrc_response: json,
          last_error: null,
          updated_at: submittedAt,
        })
        .eq("id", amendmentId);

      if (updateError) throw updateError;

      await writeAudit("amendment_hmrc_submitted", {
        message: "HMRC amendment submitted successfully.",
        response: json,
        submittedTotals: {
          income: lockedIncome,
          expenses: lockedExpenses,
          profit: lockedProfit,
        },
      });

      setMessage("HMRC amendment submitted successfully.");
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to submit HMRC amendment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="amendment-page">
        <div className="shell">
          <div className="loading-card">Loading amendment working paper...</div>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="amendment-page">
      <div className="shell">
        <div className="topbar">
          <div>
            <Link
              href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/summary`}
              className="back"
            >
              ← Back to tax year summary
            </Link>

            <div className="title-row">
              <div>
                <h1>Amendment working paper</h1>
                <p>
                  {client?.name || client?.client_name || "Client"} ·{" "}
                  {taxYear?.tax_year || taxYear?.year || "Tax year"} ·{" "}
                  <span>Amendment {amendmentId.slice(0, 8)}</span>
                </p>
              </div>

              <div className="status-wrap">
                <span className={statusClass(amendment?.status)}>
                  {amendment?.status || "draft"}
                </span>
                {isLocked && <span className="status blue">Locked</span>}
                {isSubmitted && <span className="status green">Submitted</span>}
              </div>
            </div>
          </div>
        </div>

        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice danger">{error}</div>}

        <section className="hero-grid">
          <div className="summary-card dark">
            <div className="eyebrow">Amended profit</div>
            <div className="hero-money">{money(amendedTotals.profit)}</div>
            <p>Calculated from frozen original totals plus active adjustment ledger.</p>
          </div>

          <div className="summary-card">
            <div className="eyebrow">Original profit</div>
            <div className="big-money">{money(originalTotals.profit)}</div>
            <p>Original final declaration remains preserved.</p>
          </div>

          <div className="summary-card">
            <div className="eyebrow">Profit variance</div>
            <div className="big-money">{money(adjustmentTotals.profit)}</div>
            <p>Net impact of all active amendment adjustments.</p>
          </div>

          <div className="summary-card">
            <div className="eyebrow">Ledger entries</div>
            <div className="big-money">{activeAdjustments.length}</div>
            <p>Active working paper adjustments.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Amendment calculation</h2>
              <p>Original totals, adjustment totals and amended submission totals.</p>
            </div>
          </div>

          <div className="calc-grid">
            <div className="calc-box">
              <h3>Original frozen totals</h3>
              <div className="line">
                <span>Income</span>
                <strong>{money(originalTotals.income)}</strong>
              </div>
              <div className="line">
                <span>Expenses</span>
                <strong>{money(originalTotals.expenses)}</strong>
              </div>
              <div className="line total">
                <span>Profit</span>
                <strong>{money(originalTotals.profit)}</strong>
              </div>
            </div>

            <div className="calc-box">
              <h3>Adjustment totals</h3>
              <div className="line">
                <span>Income movement</span>
                <strong>{money(adjustmentTotals.income)}</strong>
              </div>
              <div className="line">
                <span>Expense movement</span>
                <strong>{money(adjustmentTotals.expenses)}</strong>
              </div>
              <div className="line total">
                <span>Profit movement</span>
                <strong>{money(adjustmentTotals.profit)}</strong>
              </div>
            </div>

            <div className="calc-box highlight">
              <h3>Amended totals</h3>
              <div className="line">
                <span>Income</span>
                <strong>{money(amendedTotals.income)}</strong>
              </div>
              <div className="line">
                <span>Expenses</span>
                <strong>{money(amendedTotals.expenses)}</strong>
              </div>
              <div className="line total">
                <span>Profit</span>
                <strong>{money(amendedTotals.profit)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="main-grid">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Add adjustment</h2>
                <p>Use this as the accountant working paper input area.</p>
              </div>
            </div>

            {isLocked && (
              <div className="notice info">
                This amendment is locked. Unlock before adding or voiding
                adjustments.
              </div>
            )}

            <div className="form-grid">
              <label>
                Type
                <select
                  value={form.adjustment_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adjustment_type: e.target.value as "income" | "expense",
                    })
                  }
                  disabled={saving || isLocked}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>

              <label>
                Direction
                <select
                  value={form.direction}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      direction: e.target.value as "increase" | "decrease",
                    })
                  }
                  disabled={saving || isLocked}
                >
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
              </label>

              <label>
                Amount
                <input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={saving || isLocked}
                />
              </label>

              <label>
                Category
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. sales, rent, software"
                  disabled={saving || isLocked}
                />
              </label>

              <label>
                Optional quarter link
                <select
                  value={form.quarter_id}
                  onChange={(e) =>
                    setForm({ ...form, quarter_id: e.target.value })
                  }
                  disabled={saving || isLocked}
                >
                  <option value="">No quarter link</option>
                  {quarters.map((q) => (
                    <option key={q.id} value={q.id}>
                      {quarterLabel(q)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wide">
                Description
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What changed?"
                  disabled={saving || isLocked}
                />
              </label>

              <label className="wide">
                Reason / working paper note
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Why is this amendment required? Include accountant review note."
                  disabled={saving || isLocked}
                />
              </label>
            </div>

            <button
              className="primary-btn"
              onClick={addAdjustment}
              disabled={saving || isLocked}
            >
              Add adjustment
            </button>
          </div>

          <aside className="panel compliance">
            <h2>Compliance controls</h2>
            <div className="control-item">
              <strong>Digital records</strong>
              <span>CSV transactions remain internal records.</span>
            </div>
            <div className="control-item">
              <strong>HMRC payload</strong>
              <span>Submission uses locked summary totals only.</span>
            </div>
            <div className="control-item">
              <strong>Evidence</strong>
              <span>Original declaration evidence is not overwritten.</span>
            </div>
            <div className="control-item">
              <strong>Duplicate control</strong>
              <span>Submitted amendments cannot be resubmitted.</span>
            </div>
            <div className="control-item">
              <strong>Audit</strong>
              <span>Every workflow action writes to the evidence ledger.</span>
            </div>
          </aside>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Adjustment ledger</h2>
              <p>Active and voided working paper entries for this amendment.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      No adjustment entries yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.adjustment_type}</td>
                      <td>{row.direction}</td>
                      <td>{row.category || "-"}</td>
                      <td>
                        <strong>{money(row.amount)}</strong>
                      </td>
                      <td>{row.description}</td>
                      <td>{row.reason}</td>
                      <td>
                        <span
                          className={
                            row.status === "void"
                              ? "mini-status red"
                              : "mini-status green"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        {row.status !== "void" && !isLocked ? (
                          <button
                            className="ghost danger-text"
                            onClick={() => voidAdjustment(row)}
                            disabled={saving}
                          >
                            Void
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workflow">
          <div>
            <h2>Workflow actions</h2>
            <p>
              Review, approve, lock and submit the amendment using controlled
              accountant workflow steps.
            </p>
          </div>

          <div className="action-row">
            <button
              onClick={submitForReview}
              disabled={saving || isSubmitted}
              className="secondary-btn"
            >
              Submit for review
            </button>

            <button
              onClick={approveAmendment}
              disabled={saving || isSubmitted}
              className="secondary-btn"
            >
              Approve
            </button>

            <button
              onClick={lockAmendment}
              disabled={saving || isLocked || isSubmitted}
              className="blue-btn"
            >
              Lock amendment
            </button>

            <button
              onClick={unlockAmendment}
              disabled={saving || !isLocked || isSubmitted}
              className="secondary-btn"
            >
              Unlock
            </button>

            <button
              onClick={submitHmrcAmendment}
              disabled={saving || !isLocked || isSubmitted}
              className="green-btn"
            >
              Submit HMRC amendment
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Evidence ledger</h2>
              <p>Audit trail filtered by amendment ID.</p>
            </div>
          </div>

          <div className="timeline">
            {auditTrail.length === 0 ? (
              <div className="empty-card">
                No audit entries found for this amendment.
              </div>
            ) : (
              auditTrail.map((row) => (
                <div className="timeline-item" key={row.id}>
                  <div className="dot" />
                  <div>
                    <div className="timeline-title">
                      <strong>{row.action || row.event || "Audit event"}</strong>
                      <span>{formatDate(row.created_at)}</span>
                    </div>
                    <p>{row.message || row.meta?.message || "-"}</p>
                    <span className={statusClass(row.status)}>
                      {row.status || "success"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
.amendment-page {
  min-height: 100vh;
  background: #f5f7fb;
  color: #111827;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px;
}

.back {
  display: inline-flex;
  color: #2563eb;
  font-size: 14px;
  text-decoration: none;
  margin-bottom: 14px;
}

.back:hover {
  text-decoration: underline;
}

.title-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

h3 {
  margin: 0 0 16px;
  font-size: 15px;
}

p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
}

.status-wrap {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status,
.mini-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-weight: 700;
  text-transform: capitalize;
}

.status {
  padding: 8px 12px;
  font-size: 13px;
}

.mini-status {
  padding: 5px 9px;
  font-size: 12px;
}

.green {
  background: #dcfce7;
  color: #166534;
}

.blue {
  background: #dbeafe;
  color: #1d4ed8;
}

.purple {
  background: #ede9fe;
  color: #6d28d9;
}

.amber {
  background: #fef3c7;
  color: #92400e;
}

.red {
  background: #fee2e2;
  color: #b91c1c;
}

.grey {
  background: #e5e7eb;
  color: #374151;
}

.notice {
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 14px;
  margin-top: 18px;
  border: 1px solid;
}

.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
  margin-bottom: 18px;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 24px;
}

.summary-card,
.panel,
.workflow,
.loading-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.summary-card {
  padding: 22px;
}

.summary-card.dark {
  background: linear-gradient(135deg, #111827, #1e293b);
  color: #ffffff;
  border-color: #111827;
}

.summary-card.dark p,
.summary-card.dark .eyebrow {
  color: #cbd5e1;
}

.eyebrow {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hero-money {
  margin-top: 12px;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.big-money {
  margin-top: 12px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.panel,
.workflow,
.loading-card {
  padding: 24px;
  margin-top: 18px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.calc-box {
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 18px;
  padding: 18px;
}

.calc-box.highlight {
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.line.total {
  border-bottom: 0;
  font-size: 15px;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 380px;
  gap: 18px;
  align-items: start;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

label.wide {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #111827;
  border-radius: 14px;
  padding: 12px 13px;
  font-size: 14px;
  outline: none;
}

textarea {
  min-height: 110px;
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

input:disabled,
select:disabled,
textarea:disabled,
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.primary-btn,
.secondary-btn,
.blue-btn,
.green-btn,
.ghost {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn {
  margin-top: 16px;
  background: #111827;
  color: #ffffff;
}

.secondary-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #111827;
}

.blue-btn {
  background: #2563eb;
  color: #ffffff;
}

.green-btn {
  background: #16a34a;
  color: #ffffff;
}

.ghost {
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.danger-text {
  color: #b91c1c;
}

.compliance {
  position: sticky;
  top: 16px;
}

.control-item {
  padding: 14px 0;
  border-bottom: 1px solid #e5e7eb;
}

.control-item:last-child {
  border-bottom: 0;
}

.control-item strong {
  display: block;
  font-size: 14px;
}

.control-item span {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  background: #f8fafc;
  color: #475569;
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

th,
td {
  padding: 14px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

tr:last-child td {
  border-bottom: 0;
}

.empty,
.empty-card {
  color: #64748b;
  text-align: center;
  padding: 28px;
}

.workflow {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.timeline {
  display: grid;
  gap: 14px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 14px 1fr;
  gap: 14px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
}

.dot {
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 999px;
  background: #2563eb;
}

.timeline-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.timeline-title span {
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1050px) {
  .hero-grid,
  .calc-grid,
  .main-grid {
    grid-template-columns: 1fr;
  }

  .workflow,
  .title-row {
    flex-direction: column;
  }

  .action-row,
  .status-wrap {
    justify-content: flex-start;
  }

  .compliance {
    position: static;
  }
}

@media (max-width: 680px) {
  .shell {
    padding: 18px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  h1 {
    font-size: 24px;
  }

  .hero-money {
    font-size: 30px;
  }
}
`;