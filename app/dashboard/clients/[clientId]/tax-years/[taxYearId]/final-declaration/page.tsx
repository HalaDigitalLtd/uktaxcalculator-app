"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

type AuditItem = {
  action: string;
  notes: string;
  createdAt: string;
};

type WorkflowState = {
  id?: string | null;
  status: string;
  reviewState: string;
  approved: boolean;
  locked: boolean;
  submitted: boolean;
  submittedAt?: string | null;
  hmrcSubmissionId?: string | null;
  hmrcCorrelationId?: string | null;
  hmrcCalculationId?: string | null;
  hmrcSubmittedAt?: string | null;
  lastError?: string | null;
  audit: AuditItem[];
};

const defaultWorkflow: WorkflowState = {
  id: null,
  status: "not_initialised",
  reviewState: "not_started",
  approved: false,
  locked: false,
  submitted: false,
  submittedAt: null,
  hmrcSubmissionId: null,
  hmrcCorrelationId: null,
  hmrcCalculationId: null,
  hmrcSubmittedAt: null,
  lastError: null,
  audit: [],
};

function formatJson(value: any) {
  if (!value) return "No data stored.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function FinalDeclarationPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const taxYearId = params.taxYearId as string;

  const [userId, setUserId] = useState("");
  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [submissionLogs, setSubmissionLogs] = useState<Row[]>([]);
  const [selectedLog, setSelectedLog] = useState<Row | null>(null);
  const [viewerMode, setViewerMode] = useState<
    "request" | "response" | "headers" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowState>(defaultWorkflow);

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

  const preparedCount = useMemo(() => {
    return quarters.filter((q) =>
      ["prepared", "submitted", "accepted", "finalised"].includes(
        String(q.status || "").toLowerCase()
      )
    ).length;
  }, [quarters]);

  const allQuartersPrepared =
    quarters.length > 0 && preparedCount === quarters.length;

  const hasAnnualTotals = totals.income > 0 || totals.expenses > 0;

  const readyToSubmit =
    hasAnnualTotals &&
    allQuartersPrepared &&
    workflow.approved &&
    workflow.locked &&
    !workflow.submitted;

  const latestSubmissionLog = submissionLogs[0] || null;

  const addLocalAudit = (
    next: WorkflowState,
    action: string,
    notes: string
  ): WorkflowState => {
    return {
      ...next,
      audit: [
        {
          action,
          notes,
          createdAt: new Date().toISOString(),
        },
        ...(next.audit || []),
      ],
    };
  };

  const saveWorkflowToDb = async (next: WorkflowState) => {
    if (!client || !taxYear) return;

    const payload: any = {
      firm_id: client.firm_id,
      client_id: client.id,
      tax_year_id: taxYear.id,
      status: next.status,
      review_state: next.reviewState,
      approved: next.approved,
      locked: next.locked,
      submitted: next.submitted,
      submitted_at: next.submittedAt || null,
      hmrc_submission_id: next.hmrcSubmissionId || null,
      hmrc_correlation_id: next.hmrcCorrelationId || null,
      hmrc_calculation_id: next.hmrcCalculationId || null,
      hmrc_submitted_at: next.hmrcSubmittedAt || null,
      last_error: next.lastError || null,
      updated_at: new Date().toISOString(),
    };

    if (next.id) {
      const { error } = await supabase
        .from("tax_year_final_declarations")
        .update(payload)
        .eq("id", next.id);

      if (error) {
        console.error("Workflow update failed:", error);
      }
    } else {
      const { data, error } = await supabase
        .from("tax_year_final_declarations")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("Workflow insert failed:", error);
      }

      if (data?.id) next.id = data.id;
    }
  };

  const saveAuditToDb = async (
    action: string,
    notes: string,
    previous: WorkflowState,
    next: WorkflowState
  ) => {
    if (!client || !taxYear) return;

    const payload = {
      workflow_id: next.id || null,
      firm_id: client.firm_id,
      client_id: client.id,
      tax_year_id: taxYear.id,
      action,
      from_status: previous.status || null,
      to_status: next.status || null,
      notes,
            meta: {
        workflow_id: next.id || null,
        review_state_before: previous.reviewState || null,
        review_state_after: next.reviewState || null,
        approved_before: previous.approved || false,
        approved_after: next.approved || false,
        locked_before: previous.locked || false,
        locked_after: next.locked || false,
        submitted_before: previous.submitted || false,
        submitted_after: next.submitted || false,
        hmrc_submission_id: next.hmrcSubmissionId || null,
        hmrc_correlation_id: next.hmrcCorrelationId || null,
        hmrc_calculation_id: next.hmrcCalculationId || null,
        annual_income: totals.income,
        annual_expenses: totals.expenses,
        annual_profit: totals.profit,
        quarter_count: quarters.length,
        prepared_quarter_count: preparedCount,
        created_from_page: "final_declaration_page",
      },
      created_by: userId || null,
    };

    const { error } = await supabase
      .from("final_declaration_audit_trail")
      .insert(payload as any);

    if (error) {
      console.error("Audit trail insert failed:", error);
      setMessage(`Audit trail warning: ${error.message}`);
    }
  };

  const saveWorkflow = async (
    next: WorkflowState,
    action: string,
    notes: string,
    previous: WorkflowState
  ) => {
    setWorkflow(next);
    await saveWorkflowToDb(next);
    await saveAuditToDb(action, notes, previous, next);
  };

  const mapDbWorkflow = (row: Row | null, auditRows: Row[]): WorkflowState => {
    const audit = auditRows.map((a) => ({
      action: a.action,
      notes: a.notes,
      createdAt: a.created_at,
    }));

    if (!row) {
      return {
        ...defaultWorkflow,
        audit,
      };
    }

    return {
      id: row.id,
      status: row.status || "not_initialised",
      reviewState: row.review_state || "not_started",
      approved: Boolean(row.approved),
      locked: Boolean(row.locked),
      submitted: Boolean(row.submitted || row.status === "submitted"),
      submittedAt: row.submitted_at || null,
      hmrcSubmissionId: row.hmrc_submission_id || null,
      hmrcCorrelationId: row.hmrc_correlation_id || null,
      hmrcCalculationId: row.hmrc_calculation_id || null,
      hmrcSubmittedAt: row.hmrc_submitted_at || null,
      lastError: row.last_error || null,
      audit,
    };
  };

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      window.location.href = "/auth/login";
      return;
    }

    setUserId(authData.user.id);

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

    const { data: finalDeclarationData } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    const { data: auditRows } = await supabase
      .from("final_declaration_audit_trail")
      .select("*")
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: false });

    setWorkflow(mapDbWorkflow(finalDeclarationData, auditRows || []));

    const { data: logs } = await supabase
      .from("hmrc_submission_logs")
      .select("*")
      .eq("tax_year_id", taxYearId)
      .eq("submission_type", "final_declaration")
      .order("created_at", { ascending: false })
      .limit(20);

    setSubmissionLogs(logs || []);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, taxYearId]);

  const doAction = async (action: string) => {
    setActionLoading(true);
    setMessage("");

    const previous: WorkflowState = { ...workflow };
    let next: WorkflowState = { ...workflow };
    let auditAction = action;
    let auditNotes = "";

    if (action === "initialise") {
      next.status = "in_progress";
      next.reviewState = "draft";
      auditNotes = "Final declaration workflow initialised.";
      next = addLocalAudit(next, "initialise", auditNotes);
    }

    if (action === "submit_for_review") {
      next.status = "in_review";
      next.reviewState = "submitted_for_accountant_review";
      auditNotes = "Submitted for accountant review.";
      next = addLocalAudit(next, "submit_for_review", auditNotes);
    }

    if (action === "approve") {
      next.status = "approved";
      next.reviewState = "accountant_approved";
      next.approved = true;
      auditNotes = "Accountant approved the final declaration.";
      next = addLocalAudit(next, "approve", auditNotes);
    }

    if (action === "unapprove") {
      next.status = "in_review";
      next.reviewState = "approval_removed";
      next.approved = false;
      next.locked = false;
      auditNotes = "Accountant approval removed.";
      next = addLocalAudit(next, "unapprove", auditNotes);
    }

    if (action === "lock") {
      if (!next.approved) {
        setMessage("Accountant approval required before locking.");
        setActionLoading(false);
        return;
      }

      next.status = "locked";
      next.reviewState = "locked_for_submission";
      next.locked = true;
      auditNotes = "Annual declaration locked.";
      next = addLocalAudit(next, "lock", auditNotes);
    }

    if (action === "unlock") {
      next.status = next.approved ? "approved" : "in_review";
      next.reviewState = "unlocked";
      next.locked = false;
      auditNotes = "Annual declaration unlocked.";
      next = addLocalAudit(next, "unlock", auditNotes);
    }

    if (action === "submit") {
      if (!readyToSubmit) {
        setMessage("Not ready to submit. Complete all checks first.");
        setActionLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setMessage("Login session expired. Please login again.");
        setActionLoading(false);
        return;
      }

      const response = await fetch("/api/hmrc/submit-final-declaration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId,
          taxYearId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.error || "Final declaration submission failed.");
        setActionLoading(false);
        await loadData();
        return;
      }

      next.status = "submitted";
      next.reviewState = "submitted_to_hmrc";
      next.submitted = true;
      next.submittedAt = new Date().toISOString();
      next.hmrcSubmissionId = result.hmrcSubmissionId || null;
      next.hmrcCorrelationId = result.hmrcCorrelationId || null;
      next.hmrcCalculationId = result.hmrcCalculationId || null;
      next.hmrcSubmittedAt = new Date().toISOString();
      next.lastError = null;

      auditAction = "submit_final_declaration";
      auditNotes = `Final declaration submitted. Mode: ${
        result.mode || "unknown"
      }. Correlation ID: ${result.hmrcCorrelationId || "N/A"}.`;

      next = addLocalAudit(next, auditAction, auditNotes);

      setWorkflow(next);
      await saveWorkflowToDb(next);
      await saveAuditToDb(auditAction, auditNotes, previous, next);

      setMessage(result.message || "Final declaration submitted successfully.");
      await loadData();
      setActionLoading(false);
      return;
    }

    await saveWorkflow(next, auditAction, auditNotes, previous);
    setMessage("Workflow updated successfully.");
    setActionLoading(false);
    await loadData();
  };

  const retrySubmission = async (log: Row) => {
    setActionLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMessage("Login session expired. Please login again.");
      setActionLoading(false);
      return;
    }

    const response = await fetch("/api/hmrc/submit-final-declaration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        clientId,
        taxYearId,
        retryMode: true,
        retryOfLogId: log.id,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setMessage(result.error || "Retry failed.");
      await loadData();
      setActionLoading(false);
      return;
    }

    setMessage(result.message || "Retry completed successfully.");
    await loadData();
    setActionLoading(false);
  };

  const openViewer = (log: Row, mode: "request" | "response" | "headers") => {
    setSelectedLog(log);
    setViewerMode(mode);
  };

  const closeViewer = () => {
    setSelectedLog(null);
    setViewerMode(null);
  };

  const viewerTitle =
    viewerMode === "request"
      ? "HMRC Request Payload"
      : viewerMode === "response"
      ? "HMRC Response Payload"
      : viewerMode === "headers"
      ? "HMRC Response Headers"
      : "";

  const viewerData =
    viewerMode === "request"
      ? selectedLog?.request_payload
      : viewerMode === "response"
      ? selectedLog?.response_payload
      : viewerMode === "headers"
      ? selectedLog?.response_headers
      : null;

  const statusBadge = (value: string) => {
    const clean = String(value || "not_started").replaceAll("_", " ");
    return <span style={styles.badge}>{clean}</span>;
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading final declaration...</div>
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
            ← Back to tax year summary
          </Link>

          <h1 style={styles.title}>Final Declaration Workflow</h1>

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

          <button
            onClick={() => doAction("initialise")}
            disabled={actionLoading || workflow.submitted}
            style={styles.primaryButton}
          >
            Initialise / Refresh
          </button>
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
          <span style={styles.statLabel}>Ready to submit</span>
          <strong style={readyToSubmit ? styles.passValue : styles.failValue}>
            {readyToSubmit ? "YES" : "NO"}
          </strong>
        </div>
      </section>

      <section style={styles.twoCol}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Workflow Status</h2>

          <div style={styles.statusBox}>
            <span style={styles.statLabel}>Current state</span>
            <strong style={styles.statusValue}>
              {String(workflow.status).replaceAll("_", " ")}
            </strong>
          </div>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Review state</span>
              <strong>{String(workflow.reviewState).replaceAll("_", " ")}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Accountant approved</span>
              <strong>{workflow.approved ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Annual lock</span>
              <strong>{workflow.locked ? "Locked" : "Unlocked"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>HMRC submission</span>
              <strong>{workflow.submitted ? "Submitted" : "Not submitted"}</strong>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Readiness Checks</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Annual totals calculated</span>
              <strong style={hasAnnualTotals ? styles.passText : styles.failText}>
                {hasAnnualTotals ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Quarterly data exists</span>
              <strong style={quarters.length > 0 ? styles.passText : styles.failText}>
                {quarters.length > 0 ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>All quarters prepared</span>
              <strong style={allQuartersPrepared ? styles.passText : styles.failText}>
                {preparedCount}/{quarters.length}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Accountant approved</span>
              <strong style={workflow.approved ? styles.passText : styles.failText}>
                {workflow.approved ? "Pass" : "Fail"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Annual declaration locked</span>
              <strong style={workflow.locked ? styles.passText : styles.failText}>
                {workflow.locked ? "Pass" : "Fail"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {(workflow.hmrcSubmissionId ||
        workflow.hmrcCorrelationId ||
        workflow.hmrcCalculationId ||
        workflow.lastError) && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>HMRC Receipt Evidence</h2>

          <div style={styles.checkList}>
            <div style={styles.checkRow}>
              <span>Submission ID</span>
              <strong style={styles.monospace}>
                {workflow.hmrcSubmissionId || "Not stored"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Correlation ID</span>
              <strong style={styles.monospace}>
                {workflow.hmrcCorrelationId || "Not stored"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>Calculation ID</span>
              <strong style={styles.monospace}>
                {workflow.hmrcCalculationId || "Not stored"}
              </strong>
            </div>

            <div style={styles.checkRow}>
              <span>HMRC submitted at</span>
              <strong>
                {workflow.hmrcSubmittedAt
                  ? new Date(workflow.hmrcSubmittedAt).toLocaleString()
                  : "Not stored"}
              </strong>
            </div>

            {workflow.lastError && (
              <div style={styles.checkRow}>
                <span>Last error</span>
                <strong style={styles.failText}>{workflow.lastError}</strong>
              </div>
            )}
          </div>

          {latestSubmissionLog && (
            <div style={styles.viewerQuickActions}>
              <button
                type="button"
                onClick={() => openViewer(latestSubmissionLog, "request")}
                style={styles.secondaryButton}
              >
                View latest request JSON
              </button>
              <button
                type="button"
                onClick={() => openViewer(latestSubmissionLog, "response")}
                style={styles.secondaryButton}
              >
                View latest response JSON
              </button>
            </div>
          )}
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Workflow Actions</h2>

        <div style={styles.actionGrid}>
          <button
            onClick={() => doAction("submit_for_review")}
            disabled={actionLoading || workflow.locked || workflow.submitted}
            style={styles.blueButton}
          >
            Submit for Accountant Review
          </button>

          <button
            onClick={() => doAction("approve")}
            disabled={actionLoading || workflow.locked || workflow.submitted}
            style={styles.greenButton}
          >
            Accountant Approve
          </button>

          <button
            onClick={() => doAction("unapprove")}
            disabled={actionLoading || workflow.locked || workflow.submitted}
            style={styles.yellowButton}
          >
            Remove Approval
          </button>

          <button
            onClick={() => doAction("lock")}
            disabled={actionLoading || workflow.locked || workflow.submitted}
            style={styles.amberButton}
          >
            Lock Annual Declaration
          </button>

          <button
            onClick={() => doAction("unlock")}
            disabled={actionLoading || !workflow.locked || workflow.submitted}
            style={styles.slateButton}
          >
            Unlock
          </button>

          <button
            onClick={() => doAction("submit")}
            disabled={actionLoading || !readyToSubmit || workflow.submitted}
            style={styles.purpleButton}
          >
            {actionLoading ? "Submitting..." : "Submit Final Declaration"}
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Quarter Status</h2>

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
                    <td style={styles.td}>{statusBadge(q.status)}</td>
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

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Final Declaration Submission Ledger</h2>

        {submissionLogs.length === 0 ? (
          <p style={styles.muted}>No final declaration submission logs yet.</p>
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
                  <th style={styles.th}>Error</th>
                  <th style={styles.th}>Evidence</th>
                </tr>
              </thead>

              <tbody>
                {submissionLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={styles.td}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td style={styles.td}>{statusBadge(log.status)}</td>
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
                    <td style={styles.td}>{log.error_message || "-"}</td>
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
                        {String(log.status || "").toLowerCase() === "failed" && (
                          <button
                            type="button"
                            onClick={() => retrySubmission(log)}
                            disabled={actionLoading}
                            style={styles.retryButton}
                          >
                            Retry
                          </button>
                        )}
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
                Log created:{" "}
                {selectedLog.created_at
                  ? new Date(selectedLog.created_at).toLocaleString()
                  : "Unknown"}{" "}
                · Status: {selectedLog.status || "Unknown"} · HTTP:{" "}
                {selectedLog.http_status || "-"}
              </p>
            </div>

            <button
              type="button"
              onClick={closeViewer}
              style={styles.secondaryButton}
            >
              Close viewer
            </button>
          </div>

          <pre style={styles.jsonBox}>{formatJson(viewerData)}</pre>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Audit Trail</h2>

        {workflow.audit.length === 0 ? (
          <p style={styles.muted}>No audit events yet.</p>
        ) : (
          <div style={styles.auditList}>
            {workflow.audit.map((item, index) => (
              <div
                key={`${item.action}-${item.createdAt}-${index}`}
                style={styles.auditCard}
              >
                <div>
                  <strong>{item.action.replaceAll("_", " ")}</strong>
                  <p style={styles.muted}>{item.notes}</p>
                </div>
                <span style={styles.auditTime}>
                  {new Date(item.createdAt).toLocaleString()}
                </span>
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
  retryButton: {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "7px 10px",
    borderRadius: "10px",
    fontWeight: 900,
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
  statusBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "16px",
  },
  statusValue: {
    fontSize: "22px",
    fontWeight: 900,
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
  passText: {
    color: "#15803d",
  },
  failText: {
    color: "#b91c1c",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
  yellowButton: {
    border: "none",
    background: "#ca8a04",
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
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
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
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
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
  rowActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  viewerQuickActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "18px",
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
  monospace: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },
};