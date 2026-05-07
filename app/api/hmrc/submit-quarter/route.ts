import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import { hmrcRequest } from "../../../../lib/hmrc/client";
import { buildFraudHeaders } from "../../../../lib/hmrc/fraudHeaders";
import {
  buildSelfEmploymentPayload,
  buildUKPropertyPayload,
} from "../../../../lib/hmrc/payloads";
import { logHMRCSubmission } from "../../../../lib/hmrc/submissionLogger";
import {
  getAuthenticatedUserFromRequest,
  assertQuarterAccess,
} from "../../../../lib/hmrc/tenantSecurity";

function money(value: any) {
  const n = Number(value || 0);
  return Number(n.toFixed(2));
}

function normaliseBusinessType(obligation: any) {
  const raw = String(
    obligation.type_of_business ||
      obligation.typeOfBusiness ||
      obligation.business_type ||
      obligation.hmrc_source ||
      obligation.source ||
      obligation.period_key ||
      obligation.hmrc_obligation_id ||
      obligation.hmrc_response?.typeOfBusiness ||
      ""
  ).toLowerCase();

  if (raw.includes("property")) return "uk-property";
  return "self-employment";
}

function getBusinessId(obligation: any, businessType: string) {
  if (
    businessType === "uk-property" &&
    process.env.HMRC_ENVIRONMENT !== "production" &&
    process.env.HMRC_SANDBOX_UK_PROPERTY_BUSINESS_ID
  ) {
    return process.env.HMRC_SANDBOX_UK_PROPERTY_BUSINESS_ID;
  }

  const direct =
    obligation.business_id ||
    obligation.businessId ||
    obligation.hmrc_business_id ||
    obligation.source_business_id ||
    obligation.hmrc_response?.businessId;

  if (direct) return direct;

  const raw = String(obligation.period_key || obligation.hmrc_obligation_id || "");
  const parts = raw.split("_");

  if (parts.length >= 2 && parts[1]) return parts[1];

  return null;
}

function getPeriodStart(obligation: any, quarter: any) {
  return (
    obligation.period_start_date ||
    obligation.periodStartDate ||
    obligation.start_date ||
    obligation.hmrc_response?.periodStartDate ||
    quarter.period_start ||
    quarter.start_date
  );
}

function getPeriodEnd(obligation: any, quarter: any) {
  return (
    obligation.period_end_date ||
    obligation.periodEndDate ||
    obligation.end_date ||
    obligation.hmrc_response?.periodEndDate ||
    quarter.period_end ||
    quarter.end_date
  );
}

function taxYearCode(label: string) {
  const match = String(label || "").match(/20(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return label;
}

function buildEndpoint(params: {
  businessType: string;
  nino: string;
  businessId: string;
  taxYearLabel: string;
}) {
  const { businessType, nino, businessId, taxYearLabel } = params;

  if (businessType === "uk-property") {
    return `/individuals/business/property/${nino}/${businessId}/period/${taxYearCode(
      taxYearLabel
    )}`;
  }

  return `/individuals/business/self-employment/${nino}/${businessId}/period`;
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);

    let body: any = {};

    try {
      const requestText = await req.text();
      body = requestText ? JSON.parse(requestText) : {};
    } catch {
      body = {};
    }

    const quarterId = body.quarterId || body.quarter_id;
    const isRetry = Boolean(body.is_retry);
    const isAmendment = Boolean(body.is_amendment);
    const retryFailedOnly = Boolean(body.retry_failed_only);

    if (!quarterId) {
      return NextResponse.json(
        { success: false, error: "quarterId required" },
        { status: 400 }
      );
    }

    const { quarter, taxYear, client } = await assertQuarterAccess({
      userId: user.id,
      userEmail: user.email,
      quarterId,
      allowHalaAdmin: false,
    });

    const nino =
      client.nino ||
      client.ni_number ||
      client.national_insurance_number;

    if (!nino) {
      return NextResponse.json(
        { success: false, error: "Client NINO is missing" },
        { status: 400 }
      );
    }

    const { data: links, error: linksError } = await supabaseAdmin
      .from("quarter_obligations")
      .select("obligation_id")
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("quarter_id", quarterId);

    if (linksError) {
      return NextResponse.json(
        { success: false, error: linksError.message },
        { status: 500 }
      );
    }

    const obligationIds = [
      ...(links || []).map((l: any) => l.obligation_id),
      ...(quarter.obligation_id ? [quarter.obligation_id] : []),
    ];

    const uniqueObligationIds = Array.from(new Set(obligationIds)).filter(Boolean);

    if (uniqueObligationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No HMRC obligations linked to this quarter" },
        { status: 400 }
      );
    }

    const { data: obligations, error: obligationsError } = await supabaseAdmin
      .from("obligations")
      .select("*")
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .in("id", uniqueObligationIds);

    if (obligationsError || !obligations?.length) {
      return NextResponse.json(
        { success: false, error: "Linked obligations not found" },
        { status: 404 }
      );
    }

    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("quarter_id", quarterId);

    if (transactionsError) {
      return NextResponse.json(
        { success: false, error: transactionsError.message },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No transactions to submit" },
        { status: 400 }
      );
    }

    const totalIncome = money(
      transactions
        .filter((t: any) => t.type === "income")
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)
    );

    const totalExpenses = money(
      transactions
        .filter((t: any) => t.type === "expense")
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0)
    );

    const netProfit = money(totalIncome - totalExpenses);

    const totals = {
      income: totalIncome,
      expenses: totalExpenses,
      netProfit,
    };

    const { data: previousLogs } = await supabaseAdmin
      .from("hmrc_submission_logs")
      .select("*")
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("quarter_id", quarterId)
      .order("created_at", { ascending: false });

    const successfulKeys = new Set<string>();

    for (const log of previousLogs || []) {
      const statusCode = Number(log.status_code || log.http_status || 0);

      if (statusCode >= 200 && statusCode < 300) {
        successfulKeys.add(`${log.business_type}__${log.obligation_id}`);
      }
    }

    const accessToken = await getValidHmrcToken(client.firm_id);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "No valid HMRC access token found" },
        { status: 401 }
      );
    }

    const hmrcResults: any[] = [];

    for (const obligation of obligations) {
      const businessType = normaliseBusinessType(obligation);
      const businessId = getBusinessId(obligation, businessType);
      const periodStart = getPeriodStart(obligation, quarter);
      const periodEnd = getPeriodEnd(obligation, quarter);
      const taxYearLabel = taxYear.year_label || taxYear.label || "";

      const key = `${businessType}__${obligation.id}`;

      if (retryFailedOnly && successfulKeys.has(key)) {
        hmrcResults.push({
          success: true,
          skipped: true,
          obligationId: obligation.id,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          statusCode: 200,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: null,
          errorMessage:
            "Skipped because this obligation was already successfully submitted.",
          endpoint: null,
          payload: null,
          response: {
            skipped: true,
            reason: "Already successfully submitted in previous attempt",
          },
        });
        continue;
      }

      if (!businessId || !periodStart || !periodEnd) {
        hmrcResults.push({
          success: false,
          obligationId: obligation.id,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          statusCode: 0,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: "LOCAL_MAPPING_ERROR",
          errorMessage: "Missing businessId or period dates",
          endpoint: null,
          payload: null,
          response: null,
        });
        continue;
      }

      const endpoint = buildEndpoint({
        businessType,
        nino,
        businessId,
        taxYearLabel,
      });

      const hmrcPayload =
        businessType === "uk-property"
          ? buildUKPropertyPayload(totals, periodStart, periodEnd)
          : buildSelfEmploymentPayload(totals, periodStart, periodEnd);

      const hmrcResponse = await hmrcRequest({
        accessToken,
        endpoint,
        method: "POST",
        body: hmrcPayload,
        fraudHeaders: buildFraudHeaders(req),
        testScenario: "DEFAULT",
        acceptHeader: "application/vnd.hmrc.5.0+json",
      });

      const hmrcSubmissionId =
        hmrcResponse.data?.submissionId ||
        hmrcResponse.data?.id ||
        hmrcResponse.data?.receiptId ||
        null;

      const errorCode = extractErrorCode(hmrcResponse.data);
      const errorMessage = extractErrorMessage(hmrcResponse.data);

      const result = {
        success: hmrcResponse.success,
        skipped: false,
        obligationId: obligation.id,
        businessType,
        businessId,
        periodStart,
        periodEnd,
        endpoint,
        payload: hmrcPayload,
        statusCode: hmrcResponse.status,
        correlationId: hmrcResponse.correlationId,
        hmrcSubmissionId,
        errorCode,
        errorMessage,
        response: hmrcResponse.data,
      };

      hmrcResults.push(result);

      await logHMRCSubmission({
        firm_id: client.firm_id,
        client_id: client.id,
        tax_year_id: taxYear.id,
        quarter_id: quarterId,
        obligation_id: obligation.id,
        submission_id: null,
        business_type: businessType,
        hmrc_endpoint: endpoint,
        hmrc_method: "POST",
        request_payload: hmrcPayload,
        response_payload: hmrcResponse.data,
        status_code: hmrcResponse.status,
        correlation_id: hmrcResponse.correlationId,
        hmrc_submission_id: hmrcSubmissionId,
        error_code: errorCode,
        error_message: errorMessage,
        attempt_number: (previousLogs?.length || 0) + 1,
        is_retry: isRetry || retryFailedOnly,
        is_amendment: isAmendment,
        created_by: user.id,
      });
    }

    const actualAttempts = hmrcResults.filter((r) => !r.skipped);
    const allSuccess = hmrcResults.every((r) => r.success);
    const anySuccess = hmrcResults.some((r) => r.success);
    const firstError = hmrcResults.find((r) => !r.success);

    const { data: submissionRecord, error: submissionError } =
      await supabaseAdmin
        .from("submissions")
        .insert({
          quarter_id: quarterId,
          total_income: totalIncome,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          status: allSuccess
            ? "submitted"
            : anySuccess
            ? "partially_submitted"
            : "failed",
          submitted_to_hmrc: actualAttempts.some((r) => r.success),
          submitted_by: user.id,
          submitted_at: new Date().toISOString(),
          locked_at: allSuccess ? new Date().toISOString() : null,
          hmrc_status: allSuccess
            ? "submitted"
            : anySuccess
            ? "partially_submitted"
            : "failed",
          hmrc_response: hmrcResults,
          hmrc_response_payload: hmrcResults,
          hmrc_status_code: allSuccess ? 200 : firstError?.statusCode || 400,
          hmrc_correlation_id:
            hmrcResults.map((r) => r.correlationId).filter(Boolean).join(", ") ||
            null,
          hmrc_submission_id:
            hmrcResults.map((r) => r.hmrcSubmissionId).filter(Boolean).join(", ") ||
            null,
          hmrc_error_code:
            hmrcResults.find((r) => r.errorCode)?.errorCode || null,
          hmrc_error_message:
            hmrcResults.find((r) => r.errorMessage)?.errorMessage || null,
          hmrc_endpoint: retryFailedOnly
            ? "RETRY_FAILED_ONLY_MULTIPLE_OBLIGATION_SUBMISSION"
            : "MULTIPLE_OBLIGATION_SUBMISSION",
          hmrc_method: "POST",
          hmrc_request_payload: hmrcResults.map((r) => ({
            obligationId: r.obligationId,
            businessType: r.businessType,
            businessId: r.businessId,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            endpoint: r.endpoint,
            skipped: r.skipped || false,
            payload: r.payload,
          })),
          attempt_number: (previousLogs?.length || 0) + 1,
          is_amendment: isAmendment,
          payload: {
            quarter,
            client: {
              id: client.id,
              firm_id: client.firm_id,
              nino: client.nino,
              email: client.email,
            },
            obligations,
            transactions,
            totalIncome,
            totalExpenses,
            netProfit,
            retryFailedOnly,
            hmrcResults,
          },
        })
        .select("id")
        .single();

    if (submissionError) {
      return NextResponse.json(
        { success: false, error: submissionError.message, hmrcResults },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("hmrc_submission_logs")
      .update({ submission_id: submissionRecord.id })
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("quarter_id", quarterId)
      .is("submission_id", null);

    await supabaseAdmin
      .from("quarters")
      .update({
        status: allSuccess
          ? "submitted"
          : anySuccess
          ? "partially_submitted"
          : "submission_failed",
        submitted_at: anySuccess ? new Date().toISOString() : null,
      })
      .eq("id", quarterId)
      .eq("firm_id", client.firm_id);

    return NextResponse.json({
      success: allSuccess,
      partial_success: anySuccess && !allSuccess,
      mode: "real_hmrc_api",
      retryFailedOnly,
      message: allSuccess
        ? retryFailedOnly
          ? "Retry completed. All obligations are now submitted or already successful."
          : "Quarter submitted successfully to HMRC."
        : anySuccess
        ? retryFailedOnly
          ? "Retry completed. Some obligations still failed."
          : "Quarter partially submitted to HMRC. Some obligations failed."
        : "HMRC submission failed.",
      submissionId: submissionRecord.id,
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      quarterId,
      obligationCount: obligations.length,
      attemptedCount: actualAttempts.length,
      skippedCount: hmrcResults.filter((r) => r.skipped).length,
      totalIncome,
      totalExpenses,
      netProfit,
      hmrcResults,
    });
  } catch (error: any) {
    console.error("Submit quarter failed:", error);

    const message = error?.message || "Unknown HMRC submission error";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
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