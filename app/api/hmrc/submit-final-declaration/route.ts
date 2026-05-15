import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import { hmrcRequest } from "../../../../lib/hmrc/client";
import { buildFraudHeaders } from "../../../../lib/hmrc/fraudHeaders";
import { createHmrcSubmissionSnapshot } from "../../../../lib/hmrcSubmissionSnapshots";
import { getTaxYearLedgerSnapshot } from "../../../../lib/quarterLedger";
import {
  getAuthenticatedUserFromRequest,
  assertTaxYearAccess,
} from "../../../../lib/hmrc/tenantSecurity";
import { requireFirmPermission } from "../../../../lib/rbac";

function money(value: any) {
  const n = Number(value || 0);
  return Number(n.toFixed(2));
}

function taxYearCode(label: string) {
  const match = String(label || "").match(/20(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return String(label || "");
}

function extractCorrelationId(response: any) {
  return response?.correlationId || response?.data?.correlationId || null;
}

function extractSubmissionId(data: any) {
  return (
    data?.submissionId ||
    data?.id ||
    data?.receiptId ||
    data?.calculationId ||
    data?.finalDeclarationId ||
    null
  );
}

function extractCalculationId(data: any) {
  return data?.calculationId || data?.calculation_id || null;
}

function extractErrorCode(data: any) {
  return (
    data?.code ||
    data?.errorCode ||
    data?.failures?.[0]?.code ||
    data?.errors?.[0]?.code ||
    null
  );
}

function extractErrorMessage(data: any) {
  return (
    data?.message ||
    data?.errorMessage ||
    data?.failures?.[0]?.reason ||
    data?.errors?.[0]?.message ||
    data?.errors?.[0]?.reason ||
    null
  );
}

function buildEndpoint(template: string, params: { nino: string; taxYear: string }) {
  return template
    .replaceAll("{nino}", params.nino)
    .replaceAll(":nino", params.nino)
    .replaceAll("{taxYear}", params.taxYear)
    .replaceAll(":taxYear", params.taxYear);
}

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

function isFinalDeclarationSubmitted(row: any) {
  if (!row) return false;

  const status = normalise(row.status);
  const reviewState = normalise(row.review_state);

  return Boolean(
    row.submitted ||
      row.hmrc_submission_id ||
      row.hmrc_correlation_id ||
      status === "submitted" ||
      status === "submitted_to_hmrc" ||
      reviewState === "submitted_to_hmrc"
  );
}

function isRetryAllowed(row: any) {
  if (!row) return false;

  const status = normalise(row.status);
  const reviewState = normalise(row.review_state);

  return status === "submission_failed" || reviewState === "submission_failed";
}

function isApproved(row: any) {
  return Boolean(row?.approved);
}

function isLocked(row: any) {
  return Boolean(row?.locked || row?.is_locked);
}

async function insertFinalDeclarationAudit(input: {
  workflowId?: string | null;
  firmId: string;
  clientId: string;
  taxYearId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string;
  createdBy: string;
  meta?: any;
}) {
  const metaPayload = input.meta || {};

  const { error } = await supabaseAdmin
    .from("final_declaration_audit_trail")
    .insert({
      workflow_id: input.workflowId || null,
      firm_id: input.firmId,
      client_id: input.clientId,
      tax_year_id: input.taxYearId,
      action: input.action,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      notes: input.notes,
      created_by: input.createdBy,
      metadata: metaPayload,
      meta: metaPayload,
    } as any);

  if (error) {
    console.error("Final declaration audit insert failed:", error.message);
  }
}

export async function POST(req: NextRequest) {
  const now = new Date().toISOString();

  try {
    const user = await getAuthenticatedUserFromRequest(req);

    let body: any = {};
    try {
      const requestText = await req.text();
      body = requestText ? JSON.parse(requestText) : {};
    } catch {
      body = {};
    }

    const clientId = body.clientId || body.client_id;
    const taxYearId = body.taxYearId || body.tax_year_id;
    const retryMode = Boolean(body.retryMode || body.retry_mode);
    const retryOfLogId = body.retryOfLogId || body.retry_of_log_id || null;

    if (!clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "clientId and taxYearId are required" },
        { status: 400 }
      );
    }

    const { client, taxYear } = await assertTaxYearAccess({
      userId: user.id,
      userEmail: user.email,
      clientId,
      taxYearId,
      allowHalaAdmin: false,
    });

    const userFirmRole = await requireFirmPermission({
      userId: user.id,
      firmId: client.firm_id,
      permission: "hmrc:submit_final",
    });

    const { data: finalDeclaration, error: finalDeclarationError } =
      await supabaseAdmin
        .from("tax_year_final_declarations")
        .select("*")
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id)
        .maybeSingle();

    if (finalDeclarationError) {
      return NextResponse.json(
        { success: false, error: finalDeclarationError.message },
        { status: 500 }
      );
    }

    const fromStatus = finalDeclaration?.status || "not_started";

    if (!finalDeclaration) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Final Declaration workflow has not been created. Initialise, review, approve and lock before submission.",
        },
        { status: 400 }
      );
    }

    if (isFinalDeclarationSubmitted(finalDeclaration)) {
      await insertFinalDeclarationAudit({
        workflowId: finalDeclaration.id,
        firmId: client.firm_id,
        clientId: client.id,
        taxYearId: taxYear.id,
        action: "duplicate_final_declaration_blocked",
        fromStatus,
        toStatus: fromStatus,
        notes:
          "Duplicate final declaration submission blocked because this tax year already has HMRC submission evidence.",
        createdBy: user.id,
        meta: {
          existing_submission_id: finalDeclaration?.hmrc_submission_id || null,
          existing_correlation_id: finalDeclaration?.hmrc_correlation_id || null,
          existing_submitted_at:
            finalDeclaration?.hmrc_submitted_at ||
            finalDeclaration?.submitted_at ||
            null,
          retryMode,
          retryOfLogId,
          userFirmRole,
        },
      });

      return NextResponse.json(
        {
          success: false,
          locked: true,
          duplicateBlocked: true,
          error:
            "Final declaration has already been submitted. Use explicit amendment mode for any future changes.",
          hmrcSubmissionId: finalDeclaration?.hmrc_submission_id || null,
          hmrcCorrelationId: finalDeclaration?.hmrc_correlation_id || null,
          hmrcSubmittedAt:
            finalDeclaration?.hmrc_submitted_at ||
            finalDeclaration?.submitted_at ||
            null,
        },
        { status: 409 }
      );
    }

    if (!isApproved(finalDeclaration)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Final Declaration must be accountant approved before HMRC submission.",
        },
        { status: 403 }
      );
    }

    if (!isLocked(finalDeclaration)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Final Declaration must be locked before HMRC submission.",
        },
        { status: 403 }
      );
    }

    if (retryMode && !isRetryAllowed(finalDeclaration)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Retry is only allowed after a failed final declaration submission.",
        },
        { status: 409 }
      );
    }

    if (
      finalDeclaration.approved_by &&
      String(finalDeclaration.approved_by) === String(user.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Segregation of duties failed. The approver cannot be the HMRC submitter.",
        },
        { status: 403 }
      );
    }

    const currentRetryCount = Number(finalDeclaration?.retry_count || 0);
    const nextRetryCount = currentRetryCount + (retryMode ? 1 : 0);
    const attemptNumber = retryMode ? nextRetryCount + 1 : 1;

    const { data: quarters, error: quartersError } = await supabaseAdmin
      .from("quarters")
      .select("*")
      .eq("firm_id", client.firm_id)
      .eq("tax_year_id", taxYear.id)
      .order("start_date", { ascending: true });

    if (quartersError) {
      return NextResponse.json(
        { success: false, error: quartersError.message },
        { status: 500 }
      );
    }

    const safeQuarters = quarters || [];

    const preparedQuarters = safeQuarters.filter((q: any) =>
      ["prepared", "submitted", "accepted", "finalised", "ready_to_submit"].includes(
        normalise(q.status)
      )
    );

    if (!safeQuarters.length || preparedQuarters.length !== safeQuarters.length) {
      return NextResponse.json(
        {
          success: false,
          error: "All quarters must be prepared before final declaration submission.",
          quarterCount: safeQuarters.length,
          preparedCount: preparedQuarters.length,
        },
        { status: 400 }
      );
    }

    const taxYearLedger = await getTaxYearLedgerSnapshot({
  firmId: client.firm_id,
  clientId: client.id,
  taxYearId: taxYear.id,
});

const annualIncome = taxYearLedger.totals.income;
const annualExpenses = taxYearLedger.totals.expenses;
const annualProfit = taxYearLedger.totals.profit;

if (taxYearLedger.totals.transactionCount <= 0) {
  return NextResponse.json(
    {
      success: false,
      error:
        "No active digital ledger transactions found for this tax year. Final Declaration must be derived from canonical ledger evidence.",
    },
    { status: 400 }
  );
}

    const nino =
      client.nino || client.ni_number || client.national_insurance_number || null;

    if (!nino) {
      return NextResponse.json(
        { success: false, error: "Client NINO is missing" },
        { status: 400 }
      );
    }

    const finalPayload = {
      nino,
      taxYear: taxYearCode(taxYear.year_label || taxYear.label || ""),
      clientId: client.id,
      taxYearId: taxYear.id,
      firmId: client.firm_id,
      retryMode,
      retryOfLogId,
      attemptNumber,
      annualTotals: {
        income: annualIncome,
        expenses: annualExpenses,
        profit: annualProfit,
      },
      workflow: {
        finalDeclarationId: finalDeclaration.id,
        status: finalDeclaration.status,
        reviewState: finalDeclaration.review_state,
        approved: finalDeclaration.approved,
        locked: finalDeclaration.locked,
        approvedBy: finalDeclaration.approved_by || null,
        lockedBy: finalDeclaration.locked_by || null,
        submittedBy: user.id,
        submitterRole: userFirmRole,
      },
      declaration: {
        accepted: true,
        declarationAcceptedAt: now,
        declarationAcceptedBy: user.id,
      },
      quarters: taxYearLedger.quarters.map((q: any) => ({
  id: q.quarter.id,
  quarterName: q.quarter.quarter_name,
  startDate: q.quarter.start_date,
  endDate: q.quarter.end_date,
  status: q.quarter.status,
  income: q.totals.income,
  expenses: q.totals.expenses,
  profit: q.totals.profit,
  transactionCount: q.totals.transactionCount,
  sourceTotals: q.sourceTotals,
})),
};


    let hmrcStatus = 200;
    let hmrcData: any = null;
    let hmrcCorrelationId: string | null = null;
    let hmrcSubmissionId: string | null = null;
    let hmrcCalculationId: string | null = null;
    let hmrcEndpoint: string | null = null;
    const hmrcHeaders: any = null;
    let mode = "internal_sandbox_receipt";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    const endpointTemplate = process.env.HMRC_FINAL_DECLARATION_ENDPOINT_TEMPLATE;

    if (endpointTemplate) {
      const accessToken = await getValidHmrcToken(client.id);

      if (!accessToken) {
        return NextResponse.json(
          { success: false, error: "No valid HMRC access token found" },
          { status: 401 }
        );
      }

      hmrcEndpoint = buildEndpoint(endpointTemplate, {
        nino,
        taxYear: taxYearCode(taxYear.year_label || taxYear.label || ""),
      });

      const hmrcResponse = await hmrcRequest({
        accessToken,
        endpoint: hmrcEndpoint,
        method: "POST",
        body: finalPayload,
        fraudHeaders: buildFraudHeaders(req),
        testScenario: "DEFAULT",
        acceptHeader: "application/vnd.hmrc.5.0+json",
      });

      mode = "real_hmrc_api";
      hmrcStatus = hmrcResponse.status;
      hmrcData = hmrcResponse.data;
      hmrcCorrelationId = extractCorrelationId(hmrcResponse);
      hmrcSubmissionId = extractSubmissionId(hmrcResponse.data);
      hmrcCalculationId = extractCalculationId(hmrcResponse.data);
      errorCode = extractErrorCode(hmrcResponse.data);
      errorMessage = extractErrorMessage(hmrcResponse.data);

      if (!hmrcResponse.success) {
        await supabaseAdmin.from("hmrc_submission_logs").insert({
          firm_id: client.firm_id,
          client_id: client.id,
          tax_year_id: taxYear.id,
          quarter_id: null,
          submission_type: "final_declaration",
          workflow_action: "submit_final_declaration",
          hmrc_endpoint: hmrcEndpoint,
          http_method: "POST",
          http_status: hmrcStatus,
          hmrc_submission_id: hmrcSubmissionId,
          hmrc_correlation_id: hmrcCorrelationId,
          hmrc_calculation_id: hmrcCalculationId,
          request_payload: finalPayload,
          response_payload: hmrcData,
          response_headers: hmrcHeaders,
          status: "failed",
          error_message:
            errorMessage || errorCode || "HMRC final declaration failed",
          retry_of_log_id: retryOfLogId,
          attempt_number: attemptNumber,
          is_retry: retryMode,
          created_by: user.id,
          meta: {
            userFirmRole,
            canonicalWorkflowTable: "tax_year_final_declarations",
          },
        } as any);

        await supabaseAdmin
          .from("tax_year_final_declarations")
          .update({
            status: "submission_failed",
            review_state: "submission_failed",
            submitted: false,
            locked: true,
            last_error:
              errorMessage || errorCode || "HMRC final declaration failed",
            retry_count: nextRetryCount,
            updated_at: now,
          } as any)
          .eq("id", finalDeclaration.id)
          .eq("firm_id", client.firm_id)
          .eq("client_id", client.id)
          .eq("tax_year_id", taxYear.id);

        await insertFinalDeclarationAudit({
          workflowId: finalDeclaration.id,
          firmId: client.firm_id,
          clientId: client.id,
          taxYearId: taxYear.id,
          action: "submit_final_declaration_failed",
          fromStatus,
          toStatus: "submission_failed",
          notes: `Final declaration submission failed. Mode: ${mode}. Correlation ID: ${
            hmrcCorrelationId || "N/A"
          }`,
          createdBy: user.id,
          meta: {
            mode,
            retryMode,
            retryOfLogId,
            attemptNumber,
            hmrcStatus,
            hmrcSubmissionId,
            hmrcCorrelationId,
            hmrcCalculationId,
            errorCode,
            errorMessage:
              errorMessage || errorCode || "HMRC final declaration failed",
            annualTotals: finalPayload.annualTotals,
            userFirmRole,
          },
        });

        return NextResponse.json(
          {
            success: false,
            mode,
            error: errorMessage || "HMRC final declaration failed",
            errorCode,
            hmrcStatus,
            hmrcCorrelationId,
            hmrcSubmissionId,
            hmrcCalculationId,
            hmrcResponse: hmrcData,
          },
          { status: hmrcStatus || 400 }
        );
      }
    } else {
      hmrcCorrelationId = `sandbox-final-${crypto.randomUUID()}`;
      hmrcSubmissionId = `internal-final-${crypto.randomUUID()}`;
      hmrcCalculationId = null;
      hmrcEndpoint = "HMRC_FINAL_DECLARATION_ENDPOINT_TEMPLATE_NOT_SET";
      hmrcData = {
        message:
          "Internal sandbox receipt created. Set HMRC_FINAL_DECLARATION_ENDPOINT_TEMPLATE to submit to a real HMRC final declaration endpoint.",
        submissionId: hmrcSubmissionId,
        correlationId: hmrcCorrelationId,
        taxYearId: taxYear.id,
        clientId: client.id,
        firmId: client.firm_id,
        retryMode,
        retryOfLogId,
        attemptNumber,
        annualTotals: finalPayload.annualTotals,
      };
    }

    await supabaseAdmin
      .from("tax_year_final_declarations")
      .update({
        status: "submitted",
        review_state: "submitted_to_hmrc",
        approved: true,
        locked: true,
        submitted: true,
        submitted_at: now,
        hmrc_submission_id: hmrcSubmissionId,
        hmrc_correlation_id: hmrcCorrelationId,
        hmrc_calculation_id: hmrcCalculationId,
        hmrc_response_payload: hmrcData,
        hmrc_response_headers: hmrcHeaders,
        hmrc_submitted_at: now,
        last_error: null,
        retry_count: nextRetryCount,
        submitted_by: user.id,
        updated_at: now,
      } as any)
      .eq("id", finalDeclaration.id)
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("tax_year_id", taxYear.id);

    await supabaseAdmin.from("hmrc_submission_logs").insert({
      firm_id: client.firm_id,
      client_id: client.id,
      tax_year_id: taxYear.id,
      quarter_id: null,
      submission_type: "final_declaration",
      workflow_action: "submit_final_declaration",
      hmrc_endpoint: hmrcEndpoint,
      http_method: "POST",
      http_status: hmrcStatus,
      hmrc_submission_id: hmrcSubmissionId,
      hmrc_correlation_id: hmrcCorrelationId,
      hmrc_calculation_id: hmrcCalculationId,
      request_payload: finalPayload,
      response_payload: hmrcData,
      response_headers: hmrcHeaders,
      status: "submitted",
      error_message: null,
      retry_of_log_id: retryOfLogId,
      attempt_number: attemptNumber,
      is_retry: retryMode,
      created_by: user.id,
      meta: {
        userFirmRole,
        finalDeclarationId: finalDeclaration.id,
        canonicalWorkflowTable: "tax_year_final_declarations",
      },
    } as any);
    const taxYearTransactions = taxYearLedger.quarters.flatMap(
  (q: any) => q.transactions || []
);

const taxYearSourceTotals = taxYearLedger.quarters.flatMap(
  (q: any) => q.sourceTotals || []
);

const taxYearBatches = taxYearLedger.quarters.flatMap(
  (q: any) => q.batches || []
);
const snapshotRecord = await createHmrcSubmissionSnapshot({
  firmId: client.firm_id,
  clientId: client.id,
  taxYearId: taxYear.id,

  submissionType: "final_declaration",
  workflowStatus: "submitted",
  sourceRoute: "/api/hmrc/submit-final-declaration",
  sourceTable: "tax_year_final_declarations",
  sourceRecordId: finalDeclaration.id,

  hmrcPayload: finalPayload,
  hmrcResponse: hmrcData,
  fraudHeaders: buildFraudHeaders(req),

  submittedTotals: {
    income: annualIncome,
    expenses: annualExpenses,
    profit: annualProfit,
  },

  ledgerSnapshot: taxYearLedger,
  transactionSnapshot: taxYearTransactions,
sourceTotalsSnapshot: taxYearSourceTotals,
batchSnapshot: taxYearBatches,

  hmrcCorrelationId,
  hmrcSubmissionId,

  submissionAttempt: attemptNumber,

  submittedBy: user.id,
  submittedByEmail: user.email || null,
  submittedByRole: userFirmRole,

  tenantContext: {
    firmId: client.firm_id,
    clientId: client.id,
    taxYearId: taxYear.id,
  },

  auditContext: {
    immutableSnapshot: true,
    workflow: "final_declaration",
    amendmentSafe: true,
    digitalLinkSource: "ledger_entries",
    sourceCount: taxYearSourceTotals.length,
    transactionCount: taxYearLedger.totals.transactionCount,
  },
});
    await insertFinalDeclarationAudit({
      workflowId: finalDeclaration.id,
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      action: retryMode
        ? "retry_submit_final_declaration_success"
        : "submit_final_declaration_success",
      fromStatus,
      toStatus: "submitted",
      notes: `Final declaration submitted. Mode: ${mode}. Retry: ${
        retryMode ? "YES" : "NO"
      }. Correlation ID: ${hmrcCorrelationId || "N/A"}`,
      createdBy: user.id,
      meta: {
        mode,
        retryMode,
        retryOfLogId,
        attemptNumber,
        hmrcStatus,
        hmrcSubmissionId,
        hmrcCorrelationId,
        hmrcCalculationId,
        annualTotals: finalPayload.annualTotals,
        quarterCount: safeQuarters.length,
        userFirmRole,
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      retryMode,
      retryOfLogId,
      attemptNumber,
      message:
        mode === "real_hmrc_api"
          ? "Final declaration submitted to HMRC and receipt saved. Workflow is now locked."
          : retryMode
          ? "Final declaration retry completed with internal sandbox receipt. Workflow is now locked."
          : "Final declaration marked submitted with internal sandbox receipt. Workflow is now locked.",
      clientId: client.id,
      taxYearId: taxYear.id,
      firmId: client.firm_id,
      annualIncome,
      annualExpenses,
      annualProfit,
      hmrcStatus,
      hmrcSubmissionId,
      hmrcCorrelationId,
      hmrcCalculationId,
      hmrcResponse: hmrcData,
    });
  } catch (error: any) {
    console.error("Submit final declaration failed:", error);

    const message = error?.message || "Unknown final declaration submission error";

    return NextResponse.json(
      { success: false, error: message },
      {
        status:
          message === "Unauthorized" ||
          message === "Missing authorization header" ||
          message === "Missing authentication token." ||
          message === "Invalid or expired authentication token."
            ? 401
            : message.toLowerCase().includes("access denied") ||
              message.toLowerCase().includes("permission")
            ? 403
            : 500,
      }
    );
  }
}
