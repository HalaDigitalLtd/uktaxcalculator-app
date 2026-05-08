import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import { hmrcRequest } from "../../../../lib/hmrc/client";
import { buildFraudHeaders } from "../../../../lib/hmrc/fraudHeaders";
import {
  getAuthenticatedUserFromRequest,
  assertTaxYearAccess,
} from "../../../../lib/hmrc/tenantSecurity";

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

function isFinalDeclarationSubmitted(row: any) {
  if (!row) return false;

  const status = String(row.status || "").toLowerCase();
  const reviewState = String(row.review_state || "").toLowerCase();

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

  const status = String(row.status || "").toLowerCase();
  const reviewState = String(row.review_state || "").toLowerCase();

  return status === "submission_failed" || reviewState === "submission_failed";
}

async function insertFinalDeclarationAudit(input: {
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
  const { error } = await supabaseAdmin
    .from("final_declaration_audit_trail")
    .insert({
      firm_id: input.firmId,
      client_id: input.clientId,
      tax_year_id: input.taxYearId,
      action: input.action,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      notes: input.notes,
      created_by: input.createdBy,
      meta: input.meta || {},
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

    const { data: finalDeclaration } = await supabaseAdmin
      .from("tax_year_final_declarations")
      .select("*")
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("tax_year_id", taxYear.id)
      .maybeSingle();

    const fromStatus = finalDeclaration?.status || "not_started";

    if (isFinalDeclarationSubmitted(finalDeclaration)) {
      await insertFinalDeclarationAudit({
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
        String(q.status || "").toLowerCase()
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

    const annualIncome = money(
      safeQuarters.reduce(
        (sum: number, q: any) =>
          sum +
          Number(
            q.income ||
              q.income_total ||
              q.total_income ||
              q.turnover ||
              q.sales ||
              0
          ),
        0
      )
    );

    const annualExpenses = money(
      safeQuarters.reduce(
        (sum: number, q: any) =>
          sum +
          Number(
            q.expenses ||
              q.expense_total ||
              q.total_expenses ||
              q.allowable_expenses ||
              0
          ),
        0
      )
    );

    const annualProfit = money(annualIncome - annualExpenses);

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
      declaration: {
        accepted: true,
        declarationAcceptedAt: now,
        declarationAcceptedBy: user.id,
      },
      quarters: safeQuarters.map((q: any) => {
        const income = money(
          q.income ||
            q.income_total ||
            q.total_income ||
            q.turnover ||
            q.sales ||
            0
        );
        const expenses = money(
          q.expenses ||
            q.expense_total ||
            q.total_expenses ||
            q.allowable_expenses ||
            0
        );

        return {
          id: q.id,
          quarterName: q.quarter_name,
          startDate: q.start_date,
          endDate: q.end_date,
          status: q.status,
          income,
          expenses,
          profit: money(income - expenses),
        };
      }),
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
      const accessToken = await getValidHmrcToken(client.firm_id);

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
        } as any);

        if (finalDeclaration) {
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
            } as any)
            .eq("id", finalDeclaration.id)
            .eq("firm_id", client.firm_id)
            .eq("client_id", client.id)
            .eq("tax_year_id", taxYear.id);
        } else {
          await supabaseAdmin.from("tax_year_final_declarations").insert({
            firm_id: client.firm_id,
            client_id: client.id,
            tax_year_id: taxYear.id,
            status: "submission_failed",
            review_state: "submission_failed",
            approved: true,
            locked: true,
            submitted: false,
            last_error:
              errorMessage || errorCode || "HMRC final declaration failed",
            retry_count: nextRetryCount,
          } as any);
        }

        await insertFinalDeclarationAudit({
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

    if (finalDeclaration) {
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
        } as any)
        .eq("id", finalDeclaration.id)
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id);
    } else {
      await supabaseAdmin.from("tax_year_final_declarations").insert({
        firm_id: client.firm_id,
        client_id: client.id,
        tax_year_id: taxYear.id,
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
      } as any);
    }

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
    } as any);

    await insertFinalDeclarationAudit({
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
          message === "Unauthorized" || message === "Missing authorization header"
            ? 401
            : message.toLowerCase().includes("access denied")
            ? 403
            : 500,
      }
    );
  }
}