import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import { hmrcRequest } from "../../../../lib/hmrc/client";
import { buildFraudHeaders } from "../../../../lib/hmrc/fraudHeaders";
import { logHMRCSubmission } from "../../../../lib/hmrc/submissionLogger";
import {
  getAuthenticatedUserFromRequest,
  assertQuarterAccess,
} from "../../../../lib/hmrc/tenantSecurity";
import { resolveHmrcQuarterSubmissionStrategy } from "../../../../lib/hmrc/submissionStrategyResolver";

type SourceType = "self_employment" | "uk_property" | "foreign_property";

function normalise(value: any) {
  return String(value || "").toLowerCase().trim();
}

function toBusinessType(sourceType: SourceType) {
  if (sourceType === "self_employment") return "self-employment";
  if (sourceType === "uk_property") return "uk-property";
  return "foreign-property";
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

function isSourceType(value: any): value is SourceType {
  return ["self_employment", "uk_property", "foreign_property"].includes(
    normalise(value)
  );
}

function isDuplicateSnapshotError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("duplicate key value") ||
    message.includes("hmrc_submission_snapshots_idempotency_unique")
  );
}

async function loadLatestRecoverableSnapshot(params: {
  clientId: string;
  taxYearId: string;
  quarterId: string;
}) {
  return supabaseAdmin
    .from("hmrc_submission_snapshots")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("tax_year_id", params.taxYearId)
    .eq("quarter_id", params.quarterId)
    .eq("submission_type", "quarterly_update")
    .in("workflow_status", [
      "frozen_pending_submission",
      "failed",
      "partially_submitted",
    ])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
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
    const retryFailedOnly = Boolean(body.retry_failed_only);
    const requestedQuarterIncomeSourceId =
  body.quarterIncomeSourceId ||
  body.quarter_income_source_id ||
  body.sourceRowId ||
  body.source_row_id ||
  null;
    const isRetry = Boolean(body.is_retry) || retryFailedOnly;
    const isAmendment = Boolean(body.is_amendment);
    const requestedSnapshotId =
      body.snapshotId || body.snapshot_id || body.evidenceSnapshotId || null;

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

    let snapshot: any = null;
    let snapshotId = requestedSnapshotId;

    if (!snapshotId) {
      const { data: freezeResult, error: freezeError } =
        await supabaseAdmin.rpc("freeze_quarter_cumulative_submission_evidence", {
          p_client_id: client.id,
          p_tax_year_id: taxYear.id,
          p_quarter_id: quarterId,
          p_user_id: user.id,
          p_user_email: user.email || null,
        });

      if (freezeError) {
        if (!isDuplicateSnapshotError(freezeError)) {
          return NextResponse.json(
            {
              success: false,
              error: freezeError.message,
              stage: "freeze_cumulative_submission_evidence",
            },
            { status: freezeError.message.includes("already exists") ? 409 : 500 }
          );
        }

        const { data: recoveredSnapshot, error: recoveredError } =
          await loadLatestRecoverableSnapshot({
            clientId: client.id,
            taxYearId: taxYear.id,
            quarterId,
          });

        if (recoveredError || !recoveredSnapshot) {
          return NextResponse.json(
            {
              success: false,
              error:
                recoveredError?.message ||
                "Duplicate immutable snapshot exists but no recoverable latest snapshot was found.",
              originalError: freezeError.message,
              stage: "recover_existing_frozen_snapshot",
            },
            { status: 500 }
          );
        }

        snapshot = recoveredSnapshot;
        snapshotId = recoveredSnapshot.id;
      } else {
        snapshotId = freezeResult?.snapshotId;
      }
    }

    if (!snapshotId) {
      return NextResponse.json(
        { success: false, error: "Unable to resolve cumulative evidence snapshot" },
        { status: 500 }
      );
    }

    if (!snapshot) {
      const { data: loadedSnapshot, error: snapshotError } = await supabaseAdmin
        .from("hmrc_submission_snapshots")
        .select("*")
        .eq("id", snapshotId)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id)
        .eq("quarter_id", quarterId)
        .eq("submission_type", "quarterly_update")
        .single();

      if (snapshotError || !loadedSnapshot) {
        return NextResponse.json(
          {
            success: false,
            error: snapshotError?.message || "Frozen cumulative snapshot not found",
          },
          { status: 404 }
        );
      }

      snapshot = loadedSnapshot;
    }

    const payloadItems = Array.isArray(snapshot.hmrc_payload)
      ? snapshot.hmrc_payload
      : [];

    const sourceTotals = Array.isArray(snapshot.source_totals_snapshot)
      ? snapshot.source_totals_snapshot
      : [];

    const sourceTotalsByQuarterIncomeSourceId = new Map<string, any>(
      sourceTotals.map((source: any) => [
        String(source.quarterIncomeSourceId),
        source,
      ])
    );

    const payloadsWithTransactions = payloadItems.filter((item: any) => {
  if (
    requestedQuarterIncomeSourceId &&
    String(item.quarterIncomeSourceId) !==
      String(requestedQuarterIncomeSourceId)
  ) {
    return false;
  }

  const source = sourceTotalsByQuarterIncomeSourceId.get(
    String(item.quarterIncomeSourceId)
  );

  return Number(source?.transactionCount || 0) > 0;
});

    if (!payloadsWithTransactions.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No cumulative source-level transactions found. At least one HMRC income source must have ledger evidence before submission.",
          snapshotId,
        },
        { status: 400 }
      );
    }

    const sourceRowIds = payloadsWithTransactions
      .map((item: any) => item.quarterIncomeSourceId)
      .filter(Boolean);

    const { data: sourceRecords, error: sourceRecordsError } =
      await supabaseAdmin
        .from("quarter_income_sources")
        .select("*")
        .eq("firm_id", client.firm_id)
        .eq("client_id", client.id)
        .eq("tax_year_id", taxYear.id)
        .eq("quarter_id", quarterId)
        .in("id", sourceRowIds);

    if (sourceRecordsError) {
      return NextResponse.json(
        { success: false, error: sourceRecordsError.message },
        { status: 500 }
      );
    }

    const sourceRecordsById = new Map<string, any>(
      (sourceRecords || []).map((row: any) => [String(row.id), row])
    );

    const unverifiedSources = payloadsWithTransactions.filter((item: any) => {
      const sourceRecord = sourceRecordsById.get(
        String(item.quarterIncomeSourceId)
      );
      return sourceRecord?.source_evidence_status !== "verified";
    });

    if (unverifiedSources.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All submitted income sources must be HMRC verified before quarterly submission.",
          unverifiedCount: unverifiedSources.length,
          snapshotId,
        },
        { status: 400 }
      );
    }

    const { data: previousLogs } = await supabaseAdmin
      .from("hmrc_submission_logs")
      .select("*")
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id)
      .eq("quarter_id", quarterId)
      .order("created_at", { ascending: false });

    const successfulSourceRows = new Set<string>();

    for (const log of previousLogs || []) {
      const statusCode = Number(log.status_code || log.http_status || 0);
      const sourceRowId =
        log.meta?.quarterIncomeSourceId ||
        log.meta?.sourceRowId ||
        log.meta?.source_row_id ||
        null;

      if (statusCode >= 200 && statusCode < 300 && sourceRowId) {
        successfulSourceRows.add(String(sourceRowId));
      }
    }

    const accessToken = await getValidHmrcToken(client.id);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "No valid HMRC access token found" },
        { status: 401 }
      );
    }

    const fraudHeaders = buildFraudHeaders(req);
    const hmrcResults: any[] = [];
    const taxYearLabel = taxYear.year_label || taxYear.label || "";
    const attemptNumber = (previousLogs?.length || 0) + 1;

    for (const item of payloadsWithTransactions) {
      const sourceRowId = item.quarterIncomeSourceId;
      const sourceRecord = sourceRecordsById.get(String(sourceRowId));
      const sourceTotalsForRow = sourceTotalsByQuarterIncomeSourceId.get(
        String(sourceRowId)
      );

      const sourceType = item.canonicalSourceType;

      if (!isSourceType(sourceType)) {
        hmrcResults.push({
          success: false,
          skipped: false,
          sourceRowId,
          sourceType,
          statusCode: 0,
          errorCode: "LOCAL_SOURCE_TYPE_ERROR",
          errorMessage:
            "Unsupported or missing HMRC source type. Expected self_employment, uk_property or foreign_property.",
          endpoint: null,
          payload: item.payload || null,
          response: null,
        });
        continue;
      }

      const businessType = toBusinessType(sourceType);
      const businessId =
  sourceRecord?.hmrc_business_id ||
  sourceTotalsForRow?.hmrcBusinessId ||
  item.hmrcBusinessId ||
  null;

      const periodStart =
        item.fromDate ||
        sourceTotalsForRow?.fromDate ||
        sourceRecord?.period_start ||
        snapshot.period_start ||
        quarter.start_date ||
        null;

      const periodEnd =
        item.toDate ||
        sourceTotalsForRow?.toDate ||
        sourceRecord?.period_end ||
        snapshot.period_end ||
        quarter.end_date ||
        null;

      if (retryFailedOnly && successfulSourceRows.has(String(sourceRowId))) {
        hmrcResults.push({
          success: true,
          skipped: true,
          sourceRowId,
          sourceType,
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
          payload: item.payload || null,
          response: {
            skipped: true,
            reason: "Already successfully submitted in previous attempt",
          },
          sourceTotals: sourceTotalsForRow || null,
        });
        continue;
      }

      if (!businessId || !periodStart || !periodEnd) {
        hmrcResults.push({
          success: false,
          skipped: false,
          sourceRowId,
          sourceType,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          statusCode: 0,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: "LOCAL_MAPPING_ERROR",
          errorMessage:
            "Missing HMRC business ID or cumulative HMRC period dates.",
          endpoint: null,
          payload: item.payload || null,
          response: null,
          sourceTotals: sourceTotalsForRow || null,
        });
        continue;
      }

      const propertyId =
        sourceRecord?.property_id ||
        sourceRecord?.hmrc_property_id ||
        sourceRecord?.metadata?.propertyId ||
        sourceRecord?.raw_source?.propertyId ||
        null;

      const strategy = resolveHmrcQuarterSubmissionStrategy({
        sourceType,
        nino,
        businessId,
        taxYearLabel,
        propertyId,
        environment:
          process.env.HMRC_ENVIRONMENT === "production"
            ? "production"
            : "sandbox",
      });

      if (!strategy.supported) {
        const blockedResult = {
          success: false,
          skipped: false,
          blocked: true,
          sourceRowId,
          sourceType,
          businessType,
          businessId,
          propertyId,
          periodStart,
          periodEnd,
          statusCode: 400,
          correlationId: null,
          hmrcSubmissionId: null,
          errorCode: strategy.unsupportedCode,
          errorMessage: strategy.unsupportedReason,
          endpoint: null,
          payload: item.payload || null,
          response: {
            blockedSafely: true,
            strategy,
            reason: strategy.unsupportedReason,
          },
          sourceTotals: sourceTotalsForRow || null,
        };

        hmrcResults.push(blockedResult);

        await logHMRCSubmission({
          firm_id: client.firm_id,
          client_id: client.id,
          tax_year_id: taxYear.id,
          quarter_id: quarterId,
          obligation_id:
            sourceRecord?.official_obligation_id ||
            sourceRecord?.obligation_id ||
            null,
          submission_id: null,
          business_type: businessType,
          hmrc_endpoint: "BLOCKED_BY_HMRC_SUBMISSION_STRATEGY_RESOLVER",
          hmrc_method: "NONE",
          request_payload: blockedResult,
          response_payload: blockedResult.response,
          status_code: 400,
          correlation_id: null,
          hmrc_submission_id: null,
          error_code: strategy.unsupportedCode,
          error_message: strategy.unsupportedReason,
          attempt_number: attemptNumber,
          is_retry: isRetry,
          is_amendment: isAmendment,
          created_by: user.id,
          submission_type: "quarterly_update",
          workflow_action: "submit_cumulative_quarter",
          meta: {
            snapshotId,
            quarterIncomeSourceId: sourceRowId,
            sourceType,
            cumulative: true,
          },
        } as any);

        continue;
      }

      const endpoint = strategy.endpoint!;
      const hmrcPayload = item.payload;

      const hmrcResponse = await hmrcRequest({
        accessToken,
        endpoint,
        method: strategy.method!,
        body: hmrcPayload,
        fraudHeaders,
        acceptHeader: strategy.acceptHeader,
      });

      const hmrcSubmissionId =
        hmrcResponse.data?.submissionId ||
        hmrcResponse.data?.periodId ||
        hmrcResponse.data?.id ||
        hmrcResponse.data?.receiptId ||
        null;

      const errorCode = extractErrorCode(hmrcResponse.data);
      const errorMessage = extractErrorMessage(hmrcResponse.data);

      const result = {
        success: hmrcResponse.success,
        skipped: false,
        sourceRowId,
        obligationId:
          sourceRecord?.official_obligation_id ||
          sourceRecord?.obligation_id ||
          null,
        sourceType,
        businessType,
        businessId,
        propertyId,
        periodStart,
        periodEnd,
        endpoint,
        strategy,
        payload: hmrcPayload,
        statusCode: hmrcResponse.status,
        correlationId: hmrcResponse.correlationId,
        hmrcSubmissionId,
        errorCode,
        errorMessage,
        response: hmrcResponse.data,
        sourceTotals: sourceTotalsForRow || null,
        sourceEvidence: {
          hmrcIncomeSourceId: sourceRecord?.hmrc_income_source_id || null,
          evidenceStatus: sourceRecord?.source_evidence_status || null,
          sourceEvidenceSnapshot: sourceRecord?.source_evidence_snapshot || {},
        },
      };

      hmrcResults.push(result);

      await logHMRCSubmission({
        firm_id: client.firm_id,
        client_id: client.id,
        tax_year_id: taxYear.id,
        quarter_id: quarterId,
        obligation_id:
          sourceRecord?.official_obligation_id ||
          sourceRecord?.obligation_id ||
          null,
        submission_id: null,
        business_type: businessType,
        hmrc_endpoint: endpoint,
        hmrc_method: strategy.method!,
        request_payload: hmrcPayload,
        response_payload: hmrcResponse.data,
        status_code: hmrcResponse.status,
        correlation_id: hmrcResponse.correlationId,
        hmrc_submission_id: hmrcSubmissionId,
        error_code: errorCode,
        error_message: errorMessage,
        attempt_number: attemptNumber,
        is_retry: isRetry,
        is_amendment: isAmendment,
        created_by: user.id,
        submission_type: "quarterly_update",
        workflow_action: "submit_cumulative_quarter",
        meta: {
          snapshotId,
          quarterIncomeSourceId: sourceRowId,
          sourceType,
          businessType,
          businessId,
          periodStart,
          periodEnd,
          cumulative: true,
          idempotencyKey: snapshot.idempotency_key,
        },
      } as any);
    }

    const actualAttempts = hmrcResults.filter((r) => !r.skipped);
    const allSuccess =
      hmrcResults.length > 0 && hmrcResults.every((r) => r.success);
    const anySuccess = hmrcResults.some((r) => r.success);
    const firstError = hmrcResults.find((r) => !r.success);
    const now = new Date().toISOString();

    const totalIncome = Number(snapshot.income_total || 0);
    const totalExpenses = Number(snapshot.expense_total || 0);
    const netProfit = Number(snapshot.profit_total || 0);
    const transactionCount = Number(snapshot.transaction_count || 0);

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
            ? "RETRY_FAILED_ONLY_CUMULATIVE_QUARTER_SUBMISSION"
            : "CUMULATIVE_SOURCE_AWARE_QUARTER_SUBMISSION",
          hmrc_method: "PUT",
          hmrc_request_payload: hmrcResults.map((r) => ({
            sourceRowId: r.sourceRowId,
            obligationId: r.obligationId || null,
            sourceType: r.sourceType,
            businessType: r.businessType,
            businessId: r.businessId,
            propertyId: r.propertyId || null,
            strategy: r.strategy || null,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            endpoint: r.endpoint,
            skipped: r.skipped || false,
            payload: r.payload,
          })),
          attempt_number: attemptNumber,
          is_amendment: isAmendment,
          payload: {
            source: "cumulative frozen submission snapshot",
            sourceModel: "hmrc_submission_snapshots",
            snapshotId,
            idempotencyKey: snapshot.idempotency_key,
            quarter,
            client: {
              id: client.id,
              firm_id: client.firm_id,
              nino: client.nino,
              email: client.email,
            },
            totals: {
              income: totalIncome,
              expenses: totalExpenses,
              profit: netProfit,
              transactionCount,
            },
            sourceTotals,
            submittedPayloads: payloadsWithTransactions,
            transactionSnapshot: snapshot.transaction_snapshot,
            retryFailedOnly,
            hmrcResults,
          },
        } as any)
        .select("id")
        .single();

    if (submissionError) {
      return NextResponse.json(
        { success: false, error: submissionError.message, hmrcResults, snapshotId },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("hmrc_submission_snapshots")
      .update({
        workflow_status: allSuccess
          ? "submitted"
          : anySuccess
            ? "partially_submitted"
            : "failed",
        source_route: "/api/hmrc/submit-quarter",
        source_table: "submissions",
        source_record_id: submissionRecord.id,
        hmrc_response: hmrcResults,
        hmrc_correlation_id:
          hmrcResults.map((r) => r.correlationId).filter(Boolean).join(", ") ||
          null,
        hmrc_submission_id:
          hmrcResults.map((r) => r.hmrcSubmissionId).filter(Boolean).join(", ") ||
          null,
        fraud_headers: fraudHeaders,
        submitted_by: user.id,
        submitted_by_email: user.email || null,
        submitted_at: now,
        locked_at: allSuccess ? now : snapshot.locked_at,
        audit_context: {
          ...(snapshot.audit_context || {}),
          routeEngine:
            "cumulative_source_aware_quarter_submission_v4_no_gov_test_scenario",
          submittedViaRoute: true,
          recoveredExistingSnapshot: Boolean(!requestedSnapshotId),
          actualAttemptCount: actualAttempts.length,
          successCount: hmrcResults.filter((r) => r.success).length,
          failureCount: hmrcResults.filter((r) => !r.success).length,
          govTestScenarioHeader: "not_sent",
        },
      } as any)
      .eq("id", snapshotId)
      .eq("firm_id", client.firm_id)
      .eq("client_id", client.id);

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
          workflow_state: result.success
            ? "submitted"
            : anySuccess
              ? "blocked"
              : "blocked",
          workflow_state_reason: result.success
            ? "Cumulative quarterly update submitted to HMRC"
            : result.errorMessage || result.errorCode || "HMRC submission failed",
          locked: result.success ? true : false,
          submitted_at: result.success ? now : null,
          submitted_to_hmrc_at: result.success ? now : null,
          hmrc_submission_id: result.hmrcSubmissionId || null,
          hmrc_correlation_id: result.correlationId || null,
          last_error: result.success
            ? null
            : result.errorMessage || result.errorCode || "HMRC submission failed",
          last_submission_status: result.success ? "submitted" : "failed",
          evidence_snapshot: {
            snapshotId,
            submissionId: submissionRecord.id,
            sourceRowId: result.sourceRowId,
            obligationId: result.obligationId || null,
            sourceType: result.sourceType,
            businessType: result.businessType,
            businessId: result.businessId,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            sourceTotals: result.sourceTotals,
            sourceEvidence: result.sourceEvidence,
            hmrcSubmissionId: result.hmrcSubmissionId,
            correlationId: result.correlationId,
            submittedAt: now,
            cumulative: true,
            govTestScenarioHeader: "not_sent",
          },
          workflow_state_changed_at: now,
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
        submitted_at: allSuccess ? now : null,
        income: totalIncome,
        expenses: totalExpenses,
        profit: netProfit,
        updated_at: now,
      } as any)
      .eq("id", quarterId)
      .eq("tax_year_id", taxYear.id);

    await supabaseAdmin.rpc("reconcile_quarter_status_from_sources", {
      p_quarter_id: quarterId,
    });

    return NextResponse.json({
      success: allSuccess,
      partial_success: anySuccess && !allSuccess,
      mode: "real_hmrc_api",
      engine: "cumulative_source_aware_quarter_submission_v4_no_gov_test_scenario",
      source: "hmrc_submission_snapshots",
      sourceModel: "quarter_income_sources",
      retryFailedOnly,
      govTestScenarioHeader: "not_sent",
      message: allSuccess
        ? "Cumulative quarter submitted successfully to HMRC from frozen immutable ledger evidence."
        : anySuccess
          ? "Cumulative quarter partially submitted to HMRC. Some income sources failed or were blocked."
          : "HMRC cumulative quarter submission failed.",
      submissionId: submissionRecord.id,
      snapshotId,
      idempotencyKey: snapshot.idempotency_key,
      firmId: client.firm_id,
      clientId: client.id,
      taxYearId: taxYear.id,
      quarterId,
      sourceCount: sourceTotals.length,
      submittedSourceCount: payloadsWithTransactions.length,
      attemptedCount: actualAttempts.length,
      skippedCount: hmrcResults.filter((r) => r.skipped).length,
      totalIncome,
      totalExpenses,
      netProfit,
      transactionCount,
      hmrcResults,
    });
  } catch (error: any) {
    console.error("Submit cumulative quarter failed:", error);

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


