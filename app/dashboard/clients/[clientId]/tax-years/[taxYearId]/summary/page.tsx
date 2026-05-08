"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../../../lib/supabaseClient";

type Row = Record<string, any>;

const ACTIVE_AMENDMENT_STATUSES = [
  "draft",
  "in_progress",
  "in_review",
  "submitted_for_review",
  "approved",
  "locked",
  "ready_to_submit",
  "unlocked",
];

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

function toMoney(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function amount(row: Row | null, keys: string[]) {
  if (!row) return 0;

  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return Number(row[key]);
    }
  }

  return 0;
}

function formatDate(value: any) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return "-";
  }
}

export default function TaxYearSummaryPage() {
  const params = useParams();
  const clientId = String(params.clientId || "");
  const taxYearId = String(params.taxYearId || "");

  const [client, setClient] = useState<Row | null>(null);
  const [taxYear, setTaxYear] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Row[]>([]);
  const [workflow, setWorkflow] = useState<Row | null>(null);
  const [submissionLogs, setSubmissionLogs] = useState<Row[]>([]);
  const [amendments, setAmendments] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAmendment, setCreatingAmendment] = useState(false);
  const [message, setMessage] = useState("");
  const [newAmendmentReason, setNewAmendmentReason] = useState("");

  const clientName = useMemo(() => {
    if (!client) return "Client";
    return (
      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
      client.name ||
      client.client_name ||
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

    const { data: workflowData } = await supabase
      .from("tax_year_final_declarations")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    setWorkflow(workflowData || null);

    const { data: logs } = await supabase
      .from("hmrc_submission_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .eq("submission_type", "final_declaration")
      .order("created_at", { ascending: false })
      .limit(20);

    setSubmissionLogs(logs || []);

    const { data: amendmentRows, error: amendmentError } = await supabase
      .from("tax_year_amendments")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: false });

    if (amendmentError) {
      setMessage(`Amendment load error: ${amendmentError.message}`);
      setLoading(false);
      return;
    }

    setAmendments(amendmentRows || []);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId && taxYearId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const preparedQuarters = useMemo(() => {
    return quarters.filter((q) =>
      [
        "prepared",
        "submitted",
        "finalised",
        "accepted",
        "ready_to_submit",
      ].includes(normalise(q.status))
    ).length;
  }, [quarters]);

  const allQuartersPrepared =
    quarters.length > 0 && preparedQuarters === quarters.length;

  const latestSubmissionLog = submissionLogs[0] || null;

  const finalStatus =
    workflow?.status ||
    workflow?.review_state ||
    latestSubmissionLog?.status ||
    "Not started";

  const locked = Boolean(workflow?.locked || workflow?.is_locked);

  const submitted = Boolean(
    workflow?.submitted ||
      workflow?.submitted_at ||
      workflow?.hmrc_submission_id ||
      workflow?.status === "submitted" ||
      latestSubmissionLog?.status === "submitted"
  );

  const taxYearIsImmutable = submitted || locked;

  const hmrcSubmissionId =
    workflow?.hmrc_submission_id ||
    latestSubmissionLog?.hmrc_submission_id ||
    latestSubmissionLog?.submission_id ||
    null;

  const hmrcCorrelationId =
    workflow?.hmrc_correlation_id ||
    latestSubmissionLog?.hmrc_correlation_id ||
    latestSubmissionLog?.correlation_id ||
    null;

  const hmrcSubmittedAt =
    workflow?.hmrc_submitted_at ||
    workflow?.submitted_at ||
    latestSubmissionLog?.created_at ||
    null;

  const activeAmendment = useMemo(() => {
    return (
      amendments.find((a) =>
        ACTIVE_AMENDMENT_STATUSES.includes(normalise(a.status))
      ) || null
    );
  }, [amendments]);

  const submittedAmendments = useMemo(() => {
    return amendments.filter((a) =>
      ["submitted", "accepted", "hmrc_submitted"].includes(normalise(a.status))
    );
  }, [amendments]);

  const latestAmendmentNumber = useMemo(() => {
    return amendments.reduce((max, row) => {
      const current = Number(row.amendment_number || 0);
      return current > max ? current : max;
    }, 0);
  }, [amendments]);

  const activeAmendmentUrl = activeAmendment
    ? `/dashboard/clients/${clientId}/tax-years/${taxYearId}/amendments/${activeAmendment.id}`
    : "";

  async function createAmendment() {
    setMessage("");

    if (!taxYearIsImmutable || !submitted) {
      setMessage(
        "A final declaration must be submitted and locked before creating an amendment."
      );
      return;
    }

    if (activeAmendment) {
      setMessage(
        "An active amendment already exists. Continue the existing amendment before creating another."
      );
      return;
    }

    if (!newAmendmentReason.trim()) {
      setMessage("Enter a reason before creating a new amendment.");
      return;
    }

    if (!hmrcSubmissionId) {
      setMessage(
        "Original HMRC submission ID is missing. Create amendment is blocked to preserve safe amendment lineage."
      );
      return;
    }

    setCreatingAmendment(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const nextNumber = latestAmendmentNumber + 1;

      const insertPayload: Row = {
        firm_id: client?.firm_id || taxYear?.firm_id || null,
        client_id: clientId,
        tax_year_id: taxYearId,
        amendment_number: nextNumber,
        status: "draft",
        reason: newAmendmentReason.trim(),

        annual_income_snapshot: totals.income,
        annual_expenses_snapshot: totals.expenses,
        annual_profit_snapshot: totals.profit,

        locked_original_income: totals.income,
        locked_original_expenses: totals.expenses,
        locked_original_profit: totals.profit,

        original_hmrc_submission_id: hmrcSubmissionId,
        original_hmrc_correlation_id: hmrcCorrelationId,
        original_submitted_at: hmrcSubmittedAt,

        created_by: userData.user?.id || null,
        created_by_email: userData.user?.email || null,

        meta: {
          source: "tax_year_control_centre",
          amendment_lineage: {
            original_final_declaration_id: workflow?.id || null,
            original_hmrc_submission_id: hmrcSubmissionId,
            original_hmrc_correlation_id: hmrcCorrelationId,
            original_submitted_at: hmrcSubmittedAt,
          },
          original_snapshot: {
            income: totals.income,
            expenses: totals.expenses,
            profit: totals.profit,
          },
          compliance_note:
            "Original final declaration remains preserved. Amendment must be processed through separate adjustment ledger and locked submission snapshot.",
        },
      };

      const { data: created, error } = await supabase
        .from("tax_year_amendments")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;

      await supabase.from("hmrc_submission_logs").insert({
        firm_id: client?.firm_id || taxYear?.firm_id || null,
        client_id: clientId,
        tax_year_id: taxYearId,
        amendment_id: created.id,
        submission_type: "final_declaration_amendment",
        workflow_action: "create_amendment",
        action: "create_amendment",
        status: "created",
        message: "New amendment workflow created from Tax Year Control Centre.",
        created_by: userData.user?.id || null,
        meta: {
          amendment_id: created.id,
          amendment_number: nextNumber,
          reason: newAmendmentReason.trim(),
          original_hmrc_submission_id: hmrcSubmissionId,
          original_hmrc_correlation_id: hmrcCorrelationId,
          original_snapshot: {
            income: totals.income,
            expenses: totals.expenses,
            profit: totals.profit,
          },
        },
      } as any);

      window.location.href = `/dashboard/clients/${clientId}/tax-years/${taxYearId}/amendments/${created.id}`;
    } catch (e: any) {
      setMessage(e.message || "Failed to create amendment.");
      setCreatingAmendment(false);
    }
  }

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
          <Link href={`/app/clients/${clientId}`} style={styles.backLink}>
            ← Back to client
          </Link>

          <h1 style={styles.title}>Tax Year Control Centre</h1>

          <p style={styles.subtitle}>
            Client: <strong>{clientName}</strong> · Tax year:{" "}
            <strong>{taxYear?.year_label || taxYear?.label || "Unknown"}</strong>
          </p>

          <p style={styles.subtitle}>
            HMRC:{" "}
            <strong>{client?.hmrc_connected ? "Connected" : "Not connected"}</strong>{" "}
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
            style={taxYearIsImmutable ? styles.lockedButton : styles.primaryButton}
          >
            {taxYearIsImmutable
              ? "View Locked Declaration"
              : "Open Final Declaration"}
          </Link>

          {activeAmendment && (
            <Link href={activeAmendmentUrl} style={styles.successButton}>
              Continue Active Amendment
            </Link>
          )}
        </div>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {taxYearIsImmutable && (
        <section style={styles.lockBanner}>
          <h2 style={styles.lockTitle}>Final Declaration submitted</h2>
          <p style={styles.lockText}>
            This tax year is locked. Original HMRC evidence, submission ID,
            correlation ID and audit records must be preserved permanently. Any
            correction must be handled through a separate amendment workflow.
          </p>
          <p style={styles.lockMeta}>
            Normal quarter editing is blocked from this summary page to prevent
            accidental post-submission changes.
          </p>
        </section>
      )}

      {activeAmendment && (
        <section style={styles.amendmentBanner}>
          <h2 style={styles.amendmentTitle}>
            Active amendment #{activeAmendment.amendment_number || "-"}
          </h2>
          <p style={styles.amendmentText}>
            A post-submission amendment is currently open. Continue this
            amendment before creating another. The original Final Declaration
            remains locked and preserved.
          </p>
          <div style={styles.amendmentActions}>
            <Link href={activeAmendmentUrl} style={styles.amendmentButton}>
              Open amendment working paper
            </Link>
          </div>
        </section>
      )}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual income</span>
          <strong style={styles.statValue}>{toMoney(totals.income)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual expenses</span>
          <strong style={styles.statValue}>{toMoney(totals.expenses)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Annual profit</span>
          <strong style={styles.statValue}>{toMoney(totals.profit)}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Quarter readiness</span>
          <strong style={styles.statValue}>
            {preparedQuarters}/{quarters.length}
          </strong>
        </div>
      </section>

      <section style={styles.twoCol}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Final Declaration Status</h2>

          <div style={taxYearIsImmutable ? styles.lockedStatusBox : styles.statusBox}>
            <span style={styles.statusLabel}>Current state</span>
            <strong style={styles.statusValue}>
              {String(finalStatus).replaceAll("_", " ")}
            </strong>
          </div>

          <div style={styles.statusGrid}>
            <div>
              <span style={styles.miniLabel}>Review state</span>
              <strong>
                {String(workflow?.review_state || "Not started").replaceAll(
                  "_",
                  " "
                )}
              </strong>
            </div>

            <div>
              <span style={styles.miniLabel}>Accountant approved</span>
              <strong>{workflow?.approved ? "Yes" : "No"}</strong>
            </div>

            <div>
              <span style={styles.miniLabel}>Lock status</span>
              <strong>{taxYearIsImmutable ? "Locked" : "Unlocked"}</strong>
            </div>

            <div>
              <span style={styles.miniLabel}>HMRC submission</span>
              <strong>{submitted ? "Submitted" : "Not submitted"}</strong>
            </div>

            <div>
              <span style={styles.miniLabel}>Submission ID</span>
              <strong style={styles.monospace}>
                {hmrcSubmissionId || "Not available"}
              </strong>
            </div>

            <div>
              <span style={styles.miniLabel}>Correlation ID</span>
              <strong style={styles.monospace}>
                {hmrcCorrelationId || "Not available"}
              </strong>
            </div>

            <div>
              <span style={styles.miniLabel}>HMRC submitted at</span>
              <strong>{formatDate(hmrcSubmittedAt)}</strong>
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
              <span>All quarters prepared</span>
              <strong>{allQuartersPrepared ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Accountant approved</span>
              <strong>{workflow?.approved ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Final declaration locked</span>
              <strong>{taxYearIsImmutable ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>HMRC final declaration submitted</span>
              <strong>{submitted ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.checkRow}>
              <span>Active amendment</span>
              <strong>{activeAmendment ? "Yes" : "No"}</strong>
            </div>
          </div>
        </div>
      </section>

      {taxYearIsImmutable && (
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <div>
              <h2 style={styles.sectionTitle}>Amendment Command Centre</h2>
              <p style={styles.muted}>
                Create, continue and evidence all post-submission amendments
                from here. The original declaration is never overwritten.
              </p>
            </div>

            {activeAmendment && (
              <Link href={activeAmendmentUrl} style={styles.successButton}>
                Continue amendment
              </Link>
            )}
          </div>

          <div style={styles.amendmentGrid}>
            <div style={styles.amendmentInfoBox}>
              <span style={styles.statLabel}>Active amendment</span>
              <strong style={activeAmendment ? styles.passValue : styles.statValue}>
                {activeAmendment
                  ? `#${activeAmendment.amendment_number || "-"}`
                  : "None"}
              </strong>
            </div>

            <div style={styles.amendmentInfoBox}>
              <span style={styles.statLabel}>Submitted amendments</span>
              <strong style={styles.statValue}>{submittedAmendments.length}</strong>
            </div>

            <div style={styles.amendmentInfoBox}>
              <span style={styles.statLabel}>Original evidence</span>
              <strong style={styles.passText}>Preserved</strong>
            </div>
          </div>

          {!activeAmendment && (
            <div style={styles.createAmendmentBox}>
              <h3 style={styles.createTitle}>Create new amendment</h3>
              <p style={styles.muted}>
                This creates a separate amendment workflow with original HMRC
                submission lineage and frozen original totals. Adjustments will
                be entered in the amendment working paper ledger.
              </p>

              <label style={styles.label}>
                Amendment reason
                <textarea
                  value={newAmendmentReason}
                  onChange={(e) => setNewAmendmentReason(e.target.value)}
                  placeholder="Explain why this amendment is required. Example: late expense invoice identified after final declaration submission."
                  style={styles.textarea}
                  disabled={creatingAmendment}
                />
              </label>

              <button
                onClick={createAmendment}
                disabled={creatingAmendment}
                style={styles.primaryButton}
              >
                {creatingAmendment ? "Creating amendment..." : "Create New Amendment"}
              </button>
            </div>
          )}

          {amendments.length === 0 ? (
            <p style={styles.muted}>No amendments created yet.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Amendment</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Original submission</th>
                    <th style={styles.th}>Amendment submission</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {amendments.map((a) => (
                    <tr key={a.id}>
                      <td style={styles.td}>
                        <strong>#{a.amendment_number || "-"}</strong>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge}>{a.status || "draft"}</span>
                      </td>
                      <td style={styles.td}>{formatDate(a.created_at)}</td>
                      <td style={styles.td}>
                        <span style={styles.monospace}>
                          {a.original_hmrc_submission_id || hmrcSubmissionId || "-"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.monospace}>
                          {a.hmrc_submission_id || "Not submitted"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <Link
                          href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/amendments/${a.id}`}
                          style={styles.smallButton}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

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
                        <span style={styles.badge}>
                          {q.status || "not_started"}
                        </span>
                      </td>

                      <td style={styles.td}>{toMoney(income)}</td>
                      <td style={styles.td}>{toMoney(expenses)}</td>
                      <td style={styles.td}>
                        <strong>{toMoney(income - expenses)}</strong>
                      </td>

                      <td style={styles.td}>
                        {q.obligation_id ? "Linked" : "None linked"}
                      </td>

                      <td style={styles.td}>
                        {taxYearIsImmutable ? (
                          <span style={styles.disabledButton}>Locked</span>
                        ) : (
                          <Link
                            href={`/dashboard/clients/${clientId}/tax-years/${taxYearId}/quarters/${q.id}`}
                            style={styles.smallButton}
                          >
                            Open
                          </Link>
                        )}
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

        {submissionLogs.length === 0 ? (
          <p style={styles.muted}>No HMRC final declaration submissions yet.</p>
        ) : (
          <div style={styles.historyList}>
            {submissionLogs.map((log) => (
              <div key={log.id} style={styles.historyCard}>
                <div>
                  <strong>{log.status || "Unknown status"}</strong>
                  <p style={styles.muted}>Created: {formatDate(log.created_at)}</p>
                </div>

                <div style={styles.historyMeta}>
                  <span>
                    HTTP: <strong>{log.http_status || "N/A"}</strong>
                  </span>
                  <span>
                    Submission:{" "}
                    <strong>{log.hmrc_submission_id || "N/A"}</strong>
                  </span>
                  <span>
                    Correlation:{" "}
                    <strong>{log.hmrc_correlation_id || "N/A"}</strong>
                  </span>
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
    justifyContent: "flex-end",
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
    cursor: "pointer",
  },
  successButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "#16a34a",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 800,
    textDecoration: "none",
  },
  lockedButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #92400e",
    background: "#fffbeb",
    color: "#92400e",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 900,
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
  amendmentBanner: {
    background: "#ecfdf5",
    border: "1px solid #10b981",
    color: "#064e3b",
    padding: "20px",
    borderRadius: "18px",
    marginBottom: "20px",
    boxShadow: "0 10px 25px rgba(6, 95, 70, 0.08)",
  },
  amendmentTitle: {
    margin: "0 0 8px",
    fontSize: "22px",
    fontWeight: 900,
  },
  amendmentText: {
    margin: "0 0 14px",
    fontSize: "15px",
    lineHeight: 1.6,
    fontWeight: 700,
  },
  amendmentActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  amendmentButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f766e",
    color: "white",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: "12px",
    fontWeight: 900,
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
  passText: {
    color: "#15803d",
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
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "18px",
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
    lineHeight: 1.55,
  },
  statusBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "16px",
  },
  lockedStatusBox: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
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
    textTransform: "capitalize",
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
  amendmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  amendmentInfoBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
  },
  createAmendmentBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "18px",
  },
  createTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 900,
  },
  label: {
    display: "grid",
    gap: "8px",
    marginTop: "14px",
    marginBottom: "14px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
  },
  textarea: {
    minHeight: "100px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily: "inherit",
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
  disabledButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e5e7eb",
    color: "#6b7280",
    padding: "8px 12px",
    borderRadius: "10px",
    fontWeight: 900,
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
  monospace: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },
};