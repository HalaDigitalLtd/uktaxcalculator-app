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
    data?.amendmentId ||
    data?.finalDeclarationAmendmentId ||
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

function buildEndpoint(
  template: string,
  params: {
    nino: string;
    taxYear: string;
    originalSubmissionId: string;
    amendmentId: string;
  }
) {
  return template
    .replaceAll("{nino}", params.nino)
    .replaceAll(":nino", params.nino)
    .replaceAll("{taxYear}", params.taxYear)
    .replaceAll(":taxYear", params.taxYear)
    .replaceAll("{originalSubmissionId}", params.originalSubmissionId)
    .replaceAll(":originalSubmissionId", params.originalSubmissionId)
    .replaceAll("{amendmentId}", params.amendmentId)
    .replaceAll(":amendmentId", params.amendmentId);
}

function isSubmitted(row: any) {
  if (!row) return false;

  const status = String(row.status || "").toLowerCase();

  return Boolean(
    row.hmrc_submission_id ||
      row.hmrc_correlation_id ||
      status === "submitted" ||
      status === "accepted" ||
      status === "hmrc_submitted"
  );
}

function isLockedReady(row: any) {
  if (!row) return false;

  const status = String(row.status || "").toLowerCase();

  return Boolean(row.locked && status === "locked" && !isSubmitted(row));
}

async function insertAmendmentAudit(input: {
  workflowId: string | null;
  firmId: string;
  clientId: string;
  taxYearId: string;
  amendmentId: string;
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
      workflow_id: input.workflowId,
      firm_id: input.firmId,
      client_id: input.clientId,
      tax_year_id: input.taxYearId,
      action: input.action,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      notes: input.notes,
      created_by: input.createdBy,
      meta: {
        workflow_type: "final_declaration_amendment",
        amendment_id: input.amendmentId,
        ...(input.meta || {}),
      },
    } as any);

  if (error) {
    console.error("Amendment audit insert failed:", error.message);
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
    const amendmentId = body.amendmentId || body.amendment_id;

    if (!clientId || !taxYearId || !amendmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "clientId, taxYearId and amendmentId are required",
        },
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

    const { data: finalDeclaration, error: finalDeclarationError } =
      await supabaseAdmin
        .from("tax_year_final_declarations")
        .select("*")
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id)
        .maybeSingle();

    if (finalDeclarationError || !finalDeclaration) {
      return NextResponse.json(
        {
          success: false,
          error:
            finalDeclarationError?.message ||
            "Original final declaration record not found",
        },
        { status: 404 }
      );
    }

    const originalSubmitted = Boolean(
      finalDeclaration.submitted ||
        finalDeclaration.hmrc_submission_id ||
        String(finalDeclaration.status || "").toLowerCase() === "submitted"
    );

    if (!originalSubmitted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Original final declaration must be submitted before an amendment can be submitted.",
        },
        { status: 409 }
      );
    }

    const { data: amendment, error: amendmentError } = await supabaseAdmin
      .from("tax_year_amendments")
      .select("*")
      .eq("id", amendmentId)
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("tax_year_id", taxYear.id)
      .maybeSingle();

    if (amendmentError || !amendment) {
      return NextResponse.json(
        {
          success: false,
          error: amendmentError?.message || "Amendment not found",
        },
        { status: 404 }
      );
    }

    const fromStatus = amendment.status || "draft";

    if (isSubmitted(amendment)) {
      await insertAmendmentAudit({
        workflowId: finalDeclaration.id,
        firmId: client.firm_id,
        clientId: client.id,
        taxYearId: taxYear.id,
        amendmentId: amendment.id,
        action: "duplicate_amendment_submission_blocked",
        fromStatus,
        toStatus: fromStatus,
        notes:
          "Duplicate amendment submission blocked because this amendment already has HMRC evidence.",
        createdBy: user.id,
        meta: {
          existing_submission_id: amendment.hmrc_submission_id || null,
          existing_correlation_id: amendment.hmrc_correlation_id || null,
          existing_submitted_at: amendment.hmrc_submitted_at || null,
          original_final_declaration_id: finalDeclaration.id,
          original_hmrc_submission_id:
            amendment.original_hmrc_submission_id ||
            finalDeclaration.hmrc_submission_id ||
            null,
          original_hmrc_correlation_id:
            amendment.original_hmrc_correlation_id ||
            finalDeclaration.hmrc_correlation_id ||
            null,
        },
      });

      return NextResponse.json(
        {
          success: false,
          duplicateBlocked: true,
          error: "This amendment has already been submitted to HMRC.",
          hmrcSubmissionId: amendment.hmrc_submission_id || null,
          hmrcCorrelationId: amendment.hmrc_correlation_id || null,
          hmrcSubmittedAt: amendment.hmrc_submitted_at || null,
        },
        { status: 409 }
      );
    }

    if (!isLockedReady(amendment)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Amendment must be approved and locked before HMRC submission.",
          status: amendment.status || null,
          locked: Boolean(amendment.locked),
        },
        { status: 409 }
      );
    }

    const reason = String(amendment.reason || "").trim();

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          error: "Amendment reason is required before HMRC submission.",
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

    const originalSubmissionId =
      amendment.original_hmrc_submission_id ||
      finalDeclaration.hmrc_submission_id ||
      null;

    if (!originalSubmissionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Original HMRC submission ID is missing. Amendment cannot be linked safely.",
        },
        { status: 409 }
      );
    }

    const lockedIncome = money(
      amendment.locked_income ?? amendment.annual_income_snapshot ?? 0
    );
    const lockedExpenses = money(
      amendment.locked_expenses ?? amendment.annual_expenses_snapshot ?? 0
    );
    const lockedProfit = money(
      amendment.locked_profit ?? lockedIncome - lockedExpenses
    );

    const originalIncome = money(amendment.annual_income_snapshot || 0);
    const originalExpenses = money(amendment.annual_expenses_snapshot || 0);
    const originalProfit = money(
      amendment.annual_profit_snapshot ?? originalIncome - originalExpenses
    );

    const varianceIncome = money(
      amendment.variance_income ?? lockedIncome - originalIncome
    );
    const varianceExpenses = money(
      amendment.variance_expenses ?? lockedExpenses - originalExpenses
    );
    const varianceProfit = money(
      amendment.variance_profit ?? lockedProfit - originalProfit
    );

    const amendmentPayload = {
      nino,
      taxYear: taxYearCode(taxYear.year_label || taxYear.label || ""),
      clientId: client.id,
      taxYearId: taxYear.id,
      firmId: client.firm_id,
      amendmentId: amendment.id,
      amendmentNumber: amendment.amendment_number || null,
      originalFinalDeclarationId: finalDeclaration.id,
      originalHmrcSubmissionId: originalSubmissionId,
      originalHmrcCorrelationId:
        amendment.original_hmrc_correlation_id ||
        finalDeclaration.hmrc_correlation_id ||
        null,
      originalSubmittedAt:
        amendment.original_submitted_at ||
        finalDeclaration.hmrc_submitted_at ||
        finalDeclaration.submitted_at ||
        null,
      reason,
      originalTotals: {
        income: originalIncome,
        expenses: originalExpenses,
        profit: originalProfit,
      },
      amendedTotals: {
        income: lockedIncome,
        expenses: lockedExpenses,
        profit: lockedProfit,
      },
      variance: {
        income: varianceIncome,
        expenses: varianceExpenses,
        profit: varianceProfit,
      },
      declaration: {
        accepted: true,
        declarationAcceptedAt: now,
        declarationAcceptedBy: user.id,
        amendmentLockedAt: amendment.locked_at || null,
        amendmentLockedBy: amendment.locked_by || null,
        amendmentApprovedAt: amendment.approved_at || null,
        amendmentApprovedBy: amendment.approved_by || null,
      },
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

    const endpointTemplate = process.env.HMRC_FINAL_DECLARATION_AMENDMENT_ENDPOINT_TEMPLATE;

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
        taxYear: amendmentPayload.taxYear,
        originalSubmissionId,
        amendmentId: amendment.id,
      });

      const hmrcResponse = await hmrcRequest({
        accessToken,
        endpoint: hmrcEndpoint,
        method: "POST",
        body: amendmentPayload,
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
          amendment_id: amendment.id,
          submission_type: "final_declaration_amendment",
          workflow_action: "submit_final_declaration_amendment",
          hmrc_endpoint: hmrcEndpoint,
          http_method: "POST",
          http_status: hmrcStatus,
          hmrc_submission_id: hmrcSubmissionId,
          hmrc_correlation_id: hmrcCorrelationId,
          hmrc_calculation_id: hmrcCalculationId,
          request_payload: amendmentPayload,
          response_payload: hmrcData,
          response_headers: hmrcHeaders,
          status: "failed",
          error_message:
            errorMessage || errorCode || "HMRC amendment submission failed",
          created_by: user.id,
          meta: {
            amendment_id: amendment.id,
            original_final_declaration_id: finalDeclaration.id,
            original_hmrc_submission_id: originalSubmissionId,
          },
        } as any);

        await supabaseAdmin
          .from("tax_year_amendments")
          .update({
            status: "submission_failed",
            last_error:
              errorMessage || errorCode || "HMRC amendment submission failed",
            updated_at: now,
          } as any)
          .eq("id", amendment.id)
          .eq("firm_id", client.firm_id)
          .eq("client_id", client.id)
          .eq("tax_year_id", taxYear.id)
          .is("hmrc_submission_id", null);

        await insertAmendmentAudit({
          workflowId: finalDeclaration.id,
          firmId: client.firm_id,
          clientId: client.id,
          taxYearId: taxYear.id,
          amendmentId: amendment.id,
          action: "submit_amendment_failed",
          fromStatus,
          toStatus: "submission_failed",
          notes: `Final declaration amendment submission failed. Mode: ${mode}. Correlation ID: ${
            hmrcCorrelationId || "N/A"
          }`,
          createdBy: user.id,
          meta: {
            mode,
            hmrcStatus,
            hmrcSubmissionId,
            hmrcCorrelationId,
            hmrcCalculationId,
            errorCode,
            errorMessage:
              errorMessage || errorCode || "HMRC amendment submission failed",
            payload_totals: amendmentPayload.amendedTotals,
            original_totals: amendmentPayload.originalTotals,
            variance: amendmentPayload.variance,
          },
        });

        return NextResponse.json(
          {
            success: false,
            mode,
            error: errorMessage || "HMRC amendment submission failed",
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
      hmrcCorrelationId = `sandbox-amendment-${crypto.randomUUID()}`;
      hmrcSubmissionId = `internal-amendment-${crypto.randomUUID()}`;
      hmrcCalculationId = null;
      hmrcEndpoint = "HMRC_FINAL_DECLARATION_AMENDMENT_ENDPOINT_TEMPLATE_NOT_SET";
      hmrcData = {
        message:
          "Internal sandbox amendment receipt created. Set HMRC_FINAL_DECLARATION_AMENDMENT_ENDPOINT_TEMPLATE to submit to a real HMRC amendment endpoint.",
        submissionId: hmrcSubmissionId,
        correlationId: hmrcCorrelationId,
        taxYearId: taxYear.id,
        clientId: client.id,
        firmId: client.firm_id,
        amendmentId: amendment.id,
        originalHmrcSubmissionId: originalSubmissionId,
        amendedTotals: amendmentPayload.amendedTotals,
        variance: amendmentPayload.variance,
      };
    }

    const { error: amendmentUpdateError } = await supabaseAdmin
      .from("tax_year_amendments")
      .update({
        status: "submitted",
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
        updated_at: now,
      } as any)
      .eq("id", amendment.id)
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("tax_year_id", taxYear.id)
      .is("hmrc_submission_id", null);

    if (amendmentUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: amendmentUpdateError.message,
          warning:
            "HMRC amendment response was received but local amendment update failed.",
          hmrcSubmissionId,
          hmrcCorrelationId,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("hmrc_submission_logs").insert({
      firm_id: client.firm_id,
      client_id: client.id,
      tax_year_id: taxYear.id,
      quarter_id: null,
      amendment_id: amendment.id,
      submission_type: "final_declaration_amendment",
      workflow_action: "submit_final_declaration_amendment",
      hmrc_endpoint: hmrcEndpoint,
      http_method: "POST",
      http_status: hmrcStatus,
      hmrc_submission_id: hmrcSubmissionId,
      hmrc_correlation_id: hmrcCorrelationId,
      hmrc_calculation_id: hmrcCalculationId,
      request_payload: amendmentPayload,
      response_payload: hmrcData,
      response_headers: hmrcHeaders,
      status: "submitted",
      error_message: null,
      created_by: user.id,
      meta: {
        amendment_id: amendment.id,
        original_final_declaration_id: finalDeclaration.id,
        original_hmrc_submission_id: originalSubmissionId,
      },
    } as any);

    await insertAmendmentAudit({
      workflowId: finalDeclaration.id,
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      amendmentId: amendment.id,
      action: "submit_amendment_success",
      fromStatus,
      toStatus: "submitted",
      notes: `Final declaration amendment submitted. Mode: ${mode}. Correlation ID: ${
        hmrcCorrelationId || "N/A"
      }`,
      createdBy: user.id,
      meta: {
        mode,
        hmrcStatus,
        hmrcSubmissionId,
        hmrcCorrelationId,
        hmrcCalculationId,
        original_final_declaration_id: finalDeclaration.id,
        original_hmrc_submission_id: originalSubmissionId,
        payload_totals: amendmentPayload.amendedTotals,
        original_totals: amendmentPayload.originalTotals,
        variance: amendmentPayload.variance,
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      message:
        mode === "real_hmrc_api"
          ? "Amendment submitted to HMRC and evidence saved."
          : "Amendment marked submitted with internal sandbox receipt.",
      clientId: client.id,
      taxYearId: taxYear.id,
      firmId: client.firm_id,
      amendmentId: amendment.id,
      hmrcStatus,
      hmrcSubmissionId,
      hmrcCorrelationId,
      hmrcCalculationId,
      hmrcResponse: hmrcData,
    });
  } catch (error: any) {
    console.error("Submit amendment failed:", error);

    const message = error?.message || "Unknown amendment submission error";

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