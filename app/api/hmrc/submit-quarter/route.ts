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
import { getQuarterLedgerSnapshot } from "../../../../lib/quarterLedger";

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

function normaliseBusinessType(source: any, obligation: any) {
  const raw = String(
    source?.hmrc_source ||
      obligation?.type_of_business ||
      obligation?.typeOfBusiness ||
      obligation?.business_type ||
      obligation?.hmrc_source ||
      obligation?.source ||
      obligation?.hmrc_response?.typeOfBusiness ||
      ""
  ).toLowerCase();

  if (raw.includes("property")) return "uk-property";
  return "self-employment";
}

function taxYearCode(label: string) {
  const match = String(label || "").match(/20(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return String(label || "");
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
      client.nino || client.ni_number || client.national_insurance_number;

    if (!nino) {
      return NextResponse.json(
        { success: false, error: "Client NINO is missing" },
        { status: 400 }
      );
    }

    const ledger = await getQuarterLedgerSnapshot({
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      quarterId,
    });

    if (!ledger.transactions.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active quarter ledger transactions to submit. HMRC submissions must be derived from quarter_transactions only.",
        },
        { status: 400 }
      );
    }

    const sourceRows = ledger.sourceTotals;

    if (!sourceRows.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No HMRC income source rows mapped to this quarter. Create quarter_income_sources before submission.",
        },
        { status: 400 }
      );
    }

    const unpreparedSources = ledger.sources.filter(
      (source: any) =>
        ![
          "prepared",
          "ready_to_submit",
          "submitted",
          "accepted",
          "finalised",
        ].includes(normalise(source.status))
    );

    if (unpreparedSources.length > 0 && !isRetry && !isAmendment) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All income source rows must be prepared before quarterly HMRC submission.",
          unpreparedCount: unpreparedSources.length,
        },
        { status: 400 }
      );
    }

    const sourceObligationIds = sourceRows
      .map((row: any) => row.obligationId)
      .filter(Boolean);

    const { data: linkedObligations, error: obligationsError } =
      await supabaseAdmin
        .from("obligations")
        .select("*")
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .in("id", sourceObligationIds.length ? sourceObligationIds : [""]);

    if (obligationsError) {
      return NextResponse.json(
        { success: false, error: obligationsError.message },
        { status: 500 }
      );
    }

    const obligationsById = new Map(
      (linkedObligations || []).map((obligation: any) => [
        String(obligation.id),
        obligation,
      ])
    );

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
      const businessType = log.business_type || log.meta?.businessType || "";
      const obligationId = log.obligation_id || log.meta?.obligationId || "";

      if (statusCode >= 200 && statusCode < 300 && businessType && obligationId) {
        successfulKeys.add(`${businessType}__${obligationId}`);
      }
    }

    const accessToken = await getValidHmrcToken(client.firm_id);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "No valid HMRC access token found" },
        { status: 401 }
      );
    }

    const fraudHeaders = buildFraudHeaders(req);
    const hmrcResults: any[] = [];
    const taxYearLabel = taxYear.year_label || taxYear.label || "";

    for (const source of sourceRows) {
      const obligation =
        source.obligationId && obligationsById.has(String(source.obligationId))
          ? obligationsById.get(String(source.obligationId))
          : null;

      const businessType = normaliseBusinessType(source, obligation);
      const businessId =
        source.hmrcBusinessId ||
        obligation?.business_id ||
        obligation?.businessId ||
        obligation?.hmrc_business_id ||
        obligation?.source_business_id ||
        obligation?.hmrc_response?.businessId ||
        null;

      const periodStart =
        source.periodStart ||
        obligation?.period_start_date ||
        obligation?.periodStartDate ||
        obligation?.start_date ||
        obligation?.hmrc_response?.periodStartDate ||
        quarter.period_start ||
        quarter.start_date ||
        null;

      const periodEnd =
        source.periodEnd ||
        obligation?.period_end_date ||
        obligation?.periodEndDate ||
        obligation?.end_date ||
        obligation?.hmrc_response?.periodEndDate ||
        quarter.period_end ||
        quarter.end_date ||
        null;

      const key = `${businessType}__${source.obligationId}`;

      if (retryFailedOnly && successfulKeys.has(key)) {
        hmrcResults.push({
          success: true,
          skipped: true,
          sourceRowId: source.sourceRowId,
          obligationId: source.obligationId,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          statusCode: 200,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: null,
          errorMessage:
            "Skipped because this income source was already successfully submitted.",
          endpoint: null,
          payload: null,
          response: {
            skipped: true,
            reason: "Already successfully submitted in previous attempt",
          },
        });
        continue;
      }

      if (!source.obligationId || !businessId || !periodStart || !periodEnd) {
        hmrcResults.push({
          success: false,
          skipped: false,
          sourceRowId: source.sourceRowId,
          obligationId: source.obligationId,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          statusCode: 0,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: "LOCAL_MAPPING_ERROR",
          errorMessage:
            "Missing obligation ID, HMRC business ID or HMRC period dates.",
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

      const sourceTotals = {
        income: source.income,
        expenses: source.expenses,
        netProfit: source.profit,
      };

      const hmrcPayload =
        businessType === "uk-property"
          ? buildUKPropertyPayload(sourceTotals, periodStart, periodEnd)
          : buildSelfEmploymentPayload(sourceTotals, periodStart, periodEnd);

      const hmrcResponse = await hmrcRequest({
        accessToken,
        endpoint,
        method: "POST",
        body: hmrcPayload,
        fraudHeaders,
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
        sourceRowId: source.sourceRowId,
        obligationId: source.obligationId,
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
        sourceTotals,
      };

      hmrcResults.push(result);

      await logHMRCSubmission({
        firm_id: client.firm_id,
        client_id: client.id,
        tax_year_id: taxYear.id,
        quarter_id: quarterId,
        obligation_id: source.obligationId,
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

    const now = new Date().toISOString();

    const { data: submissionRecord, error: submissionError } =
      await supabaseAdmin
        .from("submissions")
        .insert({
          quarter_id: quarterId,
          total_income: ledger.totals.income,
          total_expenses: ledger.totals.expenses,
          net_profit: ledger.totals.profit,
          status: allSuccess
            ? "submitted"
            : anySuccess
              ? "partially_submitted"
              : "failed",
          submitted_to_hmrc: actualAttempts.some((r) => r.success),
          submitted_by: user.id,
          submitted_at: now,
          locked_at: allSuccess ? now : null,
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
            ? "RETRY_FAILED_ONLY_CANONICAL_LEDGER_SUBMISSION"
            : "CANONICAL_LEDGER_MULTIPLE_SOURCE_SUBMISSION",
          hmrc_method: "POST",
          hmrc_request_payload: hmrcResults.map((r) => ({
            sourceRowId: r.sourceRowId,
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
            source: "quarter_transactions",
            quarter,
            client: {
              id: client.id,
              firm_id: client.firm_id,
              nino: client.nino,
              email: client.email,
            },
            totals: ledger.totals,
            sourceTotals: ledger.sourceTotals,
            batches: ledger.batches,
            transactions: ledger.transactions,
            retryFailedOnly,
            hmrcResults,
          },
        } as any)
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

    for (const result of hmrcResults) {
      if (!result.sourceRowId || result.skipped) continue;

      await supabaseAdmin
        .from("quarter_income_sources")
        .update({
          status: result.success
            ? "submitted"
            : anySuccess
              ? "partially_submitted"
              : "submission_failed",
          submitted_at: result.success ? now : null,
          hmrc_submission_id: result.hmrcSubmissionId || null,
          hmrc_correlation_id: result.correlationId || null,
          last_error: result.success
            ? null
            : result.errorMessage || result.errorCode || "HMRC submission failed",
          last_submission_status: result.success ? "submitted" : "failed",
          evidence_snapshot: {
            submissionId: submissionRecord.id,
            sourceRowId: result.sourceRowId,
            obligationId: result.obligationId,
            businessType: result.businessType,
            businessId: result.businessId,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            sourceTotals: result.sourceTotals,
            hmrcSubmissionId: result.hmrcSubmissionId,
            correlationId: result.correlationId,
            submittedAt: now,
          },
          updated_at: now,
        } as any)
        .eq("id", result.sourceRowId)
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id)
        .eq("quarter_id", quarterId);
    }

    await supabaseAdmin
      .from("quarters")
      .update({
        status: allSuccess
          ? "submitted"
          : anySuccess
            ? "partially_submitted"
            : "submission_failed",
        submitted_at: anySuccess ? now : null,
        income: ledger.totals.income,
        expenses: ledger.totals.expenses,
        profit: ledger.totals.profit,
        updated_at: now,
      } as any)
      .eq("id", quarterId)
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("tax_year_id", taxYear.id);

    return NextResponse.json({
      success: allSuccess,
      partial_success: anySuccess && !allSuccess,
      mode: "real_hmrc_api",
      source: "quarter_transactions",
      retryFailedOnly,
      message: allSuccess
        ? retryFailedOnly
          ? "Retry completed. All income sources are now submitted or already successful."
          : "Quarter submitted successfully to HMRC from canonical digital ledger."
        : anySuccess
          ? retryFailedOnly
            ? "Retry completed. Some income sources still failed."
            : "Quarter partially submitted to HMRC. Some income sources failed."
          : "HMRC submission failed.",
      submissionId: submissionRecord.id,
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      quarterId,
      sourceCount: sourceRows.length,
      attemptedCount: actualAttempts.length,
      skippedCount: hmrcResults.filter((r) => r.skipped).length,
      totalIncome: ledger.totals.income,
      totalExpenses: ledger.totals.expenses,
      netProfit: ledger.totals.profit,
      transactionCount: ledger.totals.transactionCount,
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