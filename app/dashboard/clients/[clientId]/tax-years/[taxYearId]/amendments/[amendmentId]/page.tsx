"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

type ViewerMode = "request" | "response" | "headers" | null;

const SUBMITTED_STATUSES = ["submitted", "accepted", "hmrc_submitted"];
const LOCKED_STATUSES = ["locked", ...SUBMITTED_STATUSES];

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

function formatDate(value: any) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-GB");
  } catch {
    return "-";
  }
}

function formatJson(value: any) {
  if (!value) return "No data stored.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getAmount(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      const value = Number(row[key]);
      return Number.isFinite(value) ? value : 0;
    }
  }
  return 0;
}

function money(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

export default function AmendmentDetailPage() {
  const params = useParams();

  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;
  const amendmentId = params.amendmentId as string;

  const [userId, setUserId] = useState("");
  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [workflow, setWorkflow] = useState<Row | null>(null);
  const [amendment, setAmendment] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [auditTrail, setAuditTrail] = useState<Row[]>([]);
  const [submissionLogs, setSubmissionLogs] = useState<Row[]>([]);
  const [selectedLog, setSelectedLog] = useState<Row | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const status = normalise(amendment?.status || "draft");

  const clientName = useMemo(() => {
    if (!client) return "Client";
    return (
      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
      client.email ||
      "Client"
    );
  }, [client]);

  const currentTotals = useMemo(() => {
    let income = 0;
    let expenses = 0;

    quarters.forEach((quarter) => {
      income += getAmount(quarter, [
        "income",
        "income_total",
        "total_income",
        "turnover",
        "sales",
        "gross_income",
      ]);

      expenses += getAmount(quarter, [
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

  const originalTotals = useMemo(() => {
    const income = Number(amendment?.annual_income_snapshot || 0);
    const expenses = Number(amendment?.annual_expenses_snapshot || 0);
    const profit =
      amendment?.annual_profit_snapshot !== undefined &&
      amendment?.annual_profit_snapshot !== null
        ? Number(amendment.annual_profit_snapshot || 0)
        : income - expenses;

    return {
      income,
      expenses,
      profit,
    };
  }, [amendment]);

  const lockedTotals = useMemo(() => {
    const income =
      amendment?.locked_income !== undefined && amendment?.locked_income !== null
        ? Number(amendment.locked_income || 0)
        : null;

    const expenses =
      amendment?.locked_expenses !== undefined &&
      amendment?.locked_expenses !== null
        ? Number(amendment.locked_expenses || 0)
        : null;

    const profit =
      amendment?.locked_profit !== undefined && amendment?.locked_profit !== null
        ? Number(amendment.locked_profit || 0)
        : income !== null && expenses !== null
        ? income - expenses
        : null;

    return {
      income,
      expenses,
      profit,
    };
  }, [amendment]);

  const variance = useMemo(
    () => ({
      income: currentTotals.income - originalTotals.income,
      expenses: currentTotals.expenses - originalTotals.expenses,
      profit: currentTotals.profit - originalTotals.profit,
    }),
    [currentTotals, originalTotals]
  );

  const amendmentLocked = Boolean(
    amendment?.locked || LOCKED_STATUSES.includes(status)
  );

  const amendmentSubmitted = Boolean(
    amendment?.hmrc_submission_id || SUBMITTED_STATUSES.includes(status)
  );

  const originalSubmitted = Boolean(
    workflow?.submitted ||
      normalise(workflow?.status) === "submitted" ||
      workflow?.hmrc_submission_id ||
      amendment?.original_hmrc_submission_id
  );

  const hasReason = Boolean(String(amendment?.reason || "").trim());

  const hasVariance =
    variance.income !== 0 || variance.expenses !== 0 || variance.profit !== 0;

  const canEditReason = !amendmentLocked && !amendmentSubmitted;

  const canSubmitForReview =
    originalSubmitted &&
    hasReason &&
    !amendmentLocked &&
    !amendmentSubmitted &&
    status === "draft";

  const canApprove =
    originalSubmitted &&
    hasReason &&
    !amendmentLocked &&
    !amendmentSubmitted &&
    status === "in_review";

  const canLock =
    originalSubmitted &&
    hasReason &&
    !amendmentLocked &&
    !amendmentSubmitted &&
    status === "approved";

  const canUnlock =
    originalSubmitted &&
    amendmentLocked &&
    !amendmentSubmitted &&
    status === "locked";

  const canSubmitToHmrc =
    originalSubmitted &&
    amendmentLocked &&
    !amendmentSubmitted &&
    status === "locked";

  const viewerTitle =
    viewerMode === "request"
      ? "HMRC Amendment Request Payload"
      : viewerMode === "response"
      ? "HMRC Amendment Response Payload"
      : viewerMode === "headers"
      ? "HMRC Amendment Response Headers"
      : "";

  const viewerData =
    viewerMode === "request"
      ? selectedLog?.request_payload
      : viewerMode === "response"
      ? selectedLog?.response_payload
      : viewerMode === "headers"
      ? selectedLog?.response_headers
      : null;

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      window.location.href = "/auth/login";
      return;
    }

    setUserId(userData.user.id);

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

    const { data: auditRows } = await supabase
      .from("final_declaration_audit_trail")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .contains("meta", { amendment_id: amendmentId })
      .order("created_at", { ascending: false });

    setAuditTrail(auditRows || []);

    const { data: logs } = await supabase
      .from("hmrc_submission_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .eq("submission_type", "final_declaration_amendment")
      .order("created_at", { ascending: false })
      .limit(50);

    setSubmissionLogs(
      (logs || []).filter(
        (log) =>
          log.amendment_id === amendmentId ||
          log.meta?.amendment_id === amendmentId
      )
    );

    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId && amendmentId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, taxYearId, amendmentId]);

  const saveAudit = async (
    action: string,
    notes: string,
    fromStatus: string | null,
    toStatus: string | null,
    extraMeta: Row = {}
  ) => {
    if (!client || !taxYear || !amendment) return;

    const { error } = await supabase.from("final_declaration_audit_trail").insert({
      workflow_id: workflow?.id || amendment.original_final_declaration_id || null,
      firm_id: client.firm_id,
      client_id: client.id,
      tax_year_id: taxYear.id,
      action,
      from_status: fromStatus,
      to_status: toStatus,
      notes,
      meta: {
        workflow_type: "final_declaration_amendment",
        amendment_id: amendment.id,
        amendment_number: amendment.amendment_number || null,
        original_final_declaration_id:
          amendment.original_final_declaration_id || workflow?.id || null,
        original_hmrc_submission_id:
          amendment.original_hmrc_submission_id ||
          workflow?.hmrc_submission_id ||
          null,
        original_hmrc_correlation_id:
          amendment.original_hmrc_correlation_id ||
          workflow?.hmrc_correlation_id ||
          null,
        original_income: originalTotals.income,
        original_expenses: originalTotals.expenses,
        original_profit: originalTotals.profit,
        current_income: currentTotals.income,
        current_expenses: currentTotals.expenses,
        current_profit: currentTotals.profit,
        variance_income: variance.income,
        variance_expenses: variance.expenses,
        variance_profit: variance.profit,
        locked_income: lockedTotals.income,
        locked_expenses: lockedTotals.expenses,
        locked_profit: lockedTotals.profit,
        created_from_page: "amendment_detail_page",
        ...extraMeta,
      },
      created_by: userId || null,
    } as any);

    if (error) {
      console.error("Amendment audit insert failed:", error);
      setMessage(`Audit warning: ${error.message}`);
    }
  };

  const updateAmendment = async (
    payload: Row,
    successMessage: string,
    auditAction: string,
    auditNotes: string
  ) => {
    if (!amendment) return;

    setActionLoading(true);
    setMessage("");

    const previousStatus = amendment.status || "draft";
    const nextStatus = payload.status || previousStatus;

    const { data: latest, error: latestError } = await supabase
      .from("tax_year_amendments")
      .select("*")
      .eq("id", amendment.id)
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    if (latestError || !latest) {
      setMessage(latestError?.message || "Unable to verify amendment state.");
      setActionLoading(false);
      return;
    }

    const latestStatus = normalise(latest.status || "draft");
    const latestSubmitted = Boolean(
      latest.hmrc_submission_id || SUBMITTED_STATUSES.includes(latestStatus)
    );

    if (latestSubmitted) {
      setMessage("This amendment has already been submitted and cannot be changed.");
      await loadData();
      setActionLoading(false);
      return;
    }

    const { error } = await supabase
      .from("tax_year_amendments")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", amendment.id)
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .is("hmrc_submission_id", null);

    if (error) {
      setMessage(error.message);
      setActionLoading(false);
      return;
    }

    await saveAudit(auditAction, auditNotes, previousStatus, nextStatus, {
      update_payload: payload,
    });

    setMessage(successMessage);
    await loadData();
    setActionLoading(false);
  };

  const saveReason = async () => {
    if (!amendment) return;

    if (!canEditReason) {
      setMessage("This amendment is locked or submitted. Reason cannot be changed.");
      return;
    }

    await updateAmendment(
      {
        reason: amendment.reason || "",
      },
      "Amendment reason saved.",
      "amendment_reason_saved",
      "Amendment reason updated."
    );
  };

  const submitForReview = async () => {
    if (!canSubmitForReview) {
      setMessage("Reason and original HMRC submission are required before review.");
      return;
    }

    await updateAmendment(
      {
        status: "in_review",
        locked: false,
        submitted_for_review_at: new Date().toISOString(),
        submitted_for_review_by: userId || null,
      },
      "Amendment submitted for review.",
      "amendment_submit_for_review",
      "Amendment submitted for accountant review."
    );
  };

  const approveAmendment = async () => {
    if (!canApprove) {
      setMessage("Amendment must be in review before approval.");
      return;
    }

    await updateAmendment(
      {
        status: "approved",
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: userId || null,
        locked: false,
      },
      "Amendment approved.",
      "amendment_approved",
      "Accountant approved the amendment."
    );
  };

  const lockAmendment = async () => {
    if (!canLock) {
      setMessage("Amendment must be approved before locking.");
      return;
    }

    await updateAmendment(
      {
        status: "locked",
        locked: true,
        locked_at: new Date().toISOString(),
        locked_by: userId || null,
        locked_income: currentTotals.income,
        locked_expenses: currentTotals.expenses,
        locked_profit: currentTotals.profit,
        variance_income: variance.income,
        variance_expenses: variance.expenses,
        variance_profit: variance.profit,
      },
      "Amendment locked for HMRC submission.",
      "amendment_locked",
      "Amendment locked. Locked totals and variance values preserved."
    );
  };

  const unlockAmendment = async () => {
    if (!canUnlock) {
      setMessage("Only a locked, unsubmitted amendment can be unlocked.");
      return;
    }

    await updateAmendment(
      {
        status: "approved",
        locked: false,
        unlocked_at: new Date().toISOString(),
        unlocked_by: userId || null,
      },
      "Amendment unlocked.",
      "amendment_unlocked",
      "Locked amendment was unlocked before HMRC submission."
    );
  };

  const submitToHmrcPlaceholder = async () => {
    if (!canSubmitToHmrc) {
      setMessage("Amendment must be locked and unsubmitted before HMRC submission.");
      return;
    }

    setMessage(
      "Next step: add the server-side HMRC amendment submission route. This UI is intentionally blocked until duplicate protection, submission ledger insert, and HMRC evidence preservation are handled server-side."
    );
  };

  const openViewer = (log: Row, mode: Exclude<ViewerMode, null>) => {
    setSelectedLog(log);
    setViewerMode(mode);
  };

  const closeViewer = () => {
    setSelectedLog(null);
    setViewerMode(null);
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

          <p style={styles.subtitle}>
            Status:{" "}
            <strong>{String(amendment?.status || "draft").replaceAll("_", " ")}</strong>{" "}
            · Lock: <strong>{amendmentLocked ? "Locked" : "Unlocked"}</strong> ·
            HMRC: <strong>{amendmentSubmitted ? "Submitted" : "Not submitted"}</strong>
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
        <h2 style={styles.lockTitle}>Original declaration protected</h2>
        <p style={styles.lockText}>
          This amendment is separate from the original Final Declaration. Original
          HMRC submission ID, correlation ID, request payload and response evidence
          must remain preserved and must never be overwritten by amendment activity.
        </p>
      </section>

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Original profit</span>
          <strong style={styles.statValue}>{money(originalTotals.profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Current profit</span>
          <strong style={styles.statValue}>{money(currentTotals.profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Profit variance</span>
          <strong style={variance.profit >= 0 ? styles.passValue : styles.failValue}>
            {money(variance.profit)}
          </strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Locked profit</span>
          <strong style={styles.statValue}>
            {lockedTotals.profit === null ? "-" : money(lockedTotals.profit)}
          </strong>
        </div>
      </section>

      <section style={styles.twoCol}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Readiness Checks</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Original Final Declaration submitted</span>
              <strong style={originalSubmitted ? styles.passText : styles.failText}>
                {originalSubmitted ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Amendment reason entered</span>
              <strong style={hasReason ? styles.passText : styles.failText}>
                {hasReason ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Amendment not already submitted</span>
              <strong style={!amendmentSubmitted ? styles.passText : styles.failText}>
                {!amendmentSubmitted ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Locked for HMRC submission</span>
              <strong style={amendmentLocked ? styles.passText : styles.failText}>
                {amendmentLocked ? "Yes" : "No"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Variance detected</span>
              <strong style={hasVariance ? styles.passText : styles.failText}>
                {hasVariance ? "Yes" : "No"}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Original HMRC Evidence</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Original Final Declaration</span>
              <strong style={styles.monospace}>
                {amendment?.original_final_declaration_id || workflow?.id || "-"}
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
                {formatDate(
                  amendment?.original_submitted_at || workflow?.hmrc_submitted_at
                )}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Amendment Reason</h2>

        <textarea
          value={amendment?.reason || ""}
          disabled={!canEditReason || actionLoading}
          onChange={(event) =>
            setAmendment((previous) =>
              previous ? { ...previous, reason: event.target.value } : previous
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
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Amendment Workflow Actions</h2>

        <div style={styles.actionGrid}>
          <button
            onClick={submitForReview}
            disabled={actionLoading || !canSubmitForReview}
            style={!canSubmitForReview ? styles.disabledButton : styles.blueButton}
          >
            Submit for Review
          </button>

          <button
            onClick={approveAmendment}
            disabled={actionLoading || !canApprove}
            style={!canApprove ? styles.disabledButton : styles.greenButton}
          >
            Approve Amendment
          </button>

          <button
            onClick={lockAmendment}
            disabled={actionLoading || !canLock}
            style={!canLock ? styles.disabledButton : styles.amberButton}
          >
            Lock Amendment
          </button>

          <button
            onClick={unlockAmendment}
            disabled={actionLoading || !canUnlock}
            style={!canUnlock ? styles.disabledButton : styles.slateButton}
          >
            Unlock Amendment
          </button>

          <button
            onClick={submitToHmrcPlaceholder}
            disabled={actionLoading || !canSubmitToHmrc}
            style={!canSubmitToHmrc ? styles.disabledButton : styles.purpleButton}
          >
            Submit Amendment to HMRC
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
                <th style={styles.th}>Locked value</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={styles.td}>Income</td>
                <td style={styles.td}>{money(originalTotals.income)}</td>
                <td style={styles.td}>{money(currentTotals.income)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.income)}</strong>
                </td>
                <td style={styles.td}>
                  {lockedTotals.income === null ? "-" : money(lockedTotals.income)}
                </td>
              </tr>

              <tr>
                <td style={styles.td}>Expenses</td>
                <td style={styles.td}>{money(originalTotals.expenses)}</td>
                <td style={styles.td}>{money(currentTotals.expenses)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.expenses)}</strong>
                </td>
                <td style={styles.td}>
                  {lockedTotals.expenses === null
                    ? "-"
                    : money(lockedTotals.expenses)}
                </td>
              </tr>

              <tr>
                <td style={styles.td}>Profit</td>
                <td style={styles.td}>{money(originalTotals.profit)}</td>
                <td style={styles.td}>{money(currentTotals.profit)}</td>
                <td style={styles.td}>
                  <strong>{money(variance.profit)}</strong>
                </td>
                <td style={styles.td}>
                  {lockedTotals.profit === null ? "-" : money(lockedTotals.profit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Amendment Submission Ledger</h2>

        {submissionLogs.length === 0 ? (
          <p style={styles.muted}>No HMRC amendment submission logs yet.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>HTTP</th>
                  <th style={styles.th}>Submission ID</th>
                  <th style={styles.th}>Correlation ID</th>
                  <th style={styles.th}>Evidence</th>
                </tr>
              </thead>

              <tbody>
                {submissionLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={styles.td}>{formatDate(log.created_at)}</td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{log.status || "unknown"}</span>
                    </td>
                    <td style={styles.td}>{log.http_status || "-"}</td>
                    <td style={styles.td}>
                      <span style={styles.monospace}>
                        {log.hmrc_submission_id || "-"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.monospace}>
                        {log.hmrc_correlation_id || "-"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        <button
                          type="button"
                          onClick={() => openViewer(log, "request")}
                          style={styles.smallButton}
                        >
                          Request
                        </button>

                        <button
                          type="button"
                          onClick={() => openViewer(log, "response")}
                          style={styles.smallButton}
                        >
                          Response
                        </button>

                        <button
                          type="button"
                          onClick={() => openViewer(log, "headers")}
                          style={styles.smallButton}
                        >
                          Headers
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedLog && viewerMode && (
        <section style={styles.card}>
          <div style={styles.jsonHeader}>
            <div>
              <h2 style={styles.sectionTitle}>{viewerTitle}</h2>
              <p style={styles.muted}>
                Log created: {formatDate(selectedLog.created_at)} · Status:{" "}
                {selectedLog.status || "Unknown"} · HTTP:{" "}
                {selectedLog.http_status || "-"}
              </p>
            </div>

            <button type="button" onClick={closeViewer} style={styles.secondaryButton}>
              Close viewer
            </button>
          </div>

          <pre style={styles.jsonBox}>{formatJson(viewerData)}</pre>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Amendment Audit Trail</h2>

        {auditTrail.length === 0 ? (
          <p style={styles.muted}>No amendment audit events yet.</p>
        ) : (
          <div style={styles.auditList}>
            {auditTrail.map((item) => (
              <div key={item.id} style={styles.auditCard}>
                <div>
                  <strong>{String(item.action || "").replaceAll("_", " ")}</strong>
                  <p style={styles.muted}>{item.notes || "-"}</p>
                </div>

                <span style={styles.auditTime}>{formatDate(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Quarter Data Reference</h2>

        <p style={styles.muted}>
          Current records are used only to calculate the amendment variance.
          Original HMRC submission evidence remains separate. Once the amendment
          is locked, the locked totals above become the submission basis.
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
              {quarters.map((quarter) => {
                const income = getAmount(quarter, [
                  "income",
                  "income_total",
                  "total_income",
                  "turnover",
                  "sales",
                  "gross_income",
                ]);

                const expenses = getAmount(quarter, [
                  "expenses",
                  "expense_total",
                  "total_expenses",
                  "allowable_expenses",
                ]);

                return (
                  <tr key={quarter.id}>
                    <td style={styles.td}>
                      <strong>{quarter.quarter_name || "Quarter"}</strong>
                    </td>
                    <td style={styles.td}>
                      {quarter.start_date || "?"} to {quarter.end_date || "?"}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge}>
                        {quarter.status || "not_started"}
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
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#111827",
    padding: "7px 10px",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "12px",
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
  passText: {
    color: "#15803d",
    fontWeight: 900,
  },
  failText: {
    color: "#b91c1c",
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
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
  slateButton: {
    border: "none",
    background: "#475569",
    color: "white",
    padding: "12px",
    borderRadius: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  purpleButton: {
    border: "none",
    background: "#7e22ce",
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
  rowActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  jsonHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  jsonBox: {
    margin: 0,
    background: "#0f172a",
    color: "#e5e7eb",
    padding: "18px",
    borderRadius: "14px",
    overflowX: "auto",
    maxHeight: "520px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  auditList: {
    display: "grid",
    gap: "12px",
  },
  auditCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    background: "#fbfdff",
  },
  auditTime: {
    color: "#64748b",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  monospace: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },
};