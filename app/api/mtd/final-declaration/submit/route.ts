import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const HMRC_BASE_URL = (
  process.env.HMRC_API_BASE_URL || "https://test-api.service.hmrc.gov.uk"
).replace(/\/$/, "");

function cleanNino(nino: string) {
  return String(nino || "").replace(/\s+/g, "").toUpperCase();
}

function normaliseTaxYear(label: string) {
  return String(label || "").trim();
}

function getErrorText(err: any) {
  const parts = [
    err?.message,
    err?.cause?.message,
    err?.cause?.code,
    err?.code,
    err?.status ? `status:${err.status}` : null,
  ].filter(Boolean);

  return parts.join(" | ") || "Unknown error";
}

async function updateWorkflow(payload: any) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"}/api/mtd/final-declaration/workflow`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  return response.json();
}

async function safeReadSingle(table: string, filters: Record<string, any>) {
  try {
    let query = supabaseAdmin.from(table).select("*");

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) query = query.eq(key, value);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function getClientAndTaxYear(clientId: string, taxYearId: string) {
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Client record not found.");
  }

  const { data: taxYear, error: taxYearError } = await supabaseAdmin
    .from("tax_years")
    .select("*")
    .eq("id", taxYearId)
    .maybeSingle();

  if (taxYearError || !taxYear) {
    throw new Error("Tax year record not found.");
  }

  const nino = cleanNino(
    client.nino || client.ni_number || client.national_insurance_number
  );

  if (!nino) {
    throw new Error("Client NINO is missing. Add NINO before final declaration.");
  }

  const taxYearLabel = normaliseTaxYear(
    taxYear.year_label || taxYear.tax_year || taxYear.label
  );

  if (!taxYearLabel) {
    throw new Error("Tax year label is missing.");
  }

  return { client, taxYear, nino, taxYearLabel };
}

async function getHmrcAccessToken(firmId: string, clientId: string) {
  const possibleRecords = [
    await safeReadSingle("hmrc_connections", { firm_id: firmId, client_id: clientId }),
    await safeReadSingle("hmrc_connections", { firm_id: firmId }),
    await safeReadSingle("hmrc_tokens", { firm_id: firmId, client_id: clientId }),
    await safeReadSingle("hmrc_tokens", { firm_id: firmId }),
    await safeReadSingle("hmrc_oauth_tokens", { firm_id: firmId, client_id: clientId }),
    await safeReadSingle("hmrc_oauth_tokens", { firm_id: firmId }),
  ].filter(Boolean);

  const record: any = possibleRecords.find(
    (r: any) => r.access_token || r.hmrc_access_token
  );

  if (!record) {
    throw new Error("HMRC OAuth token not found. Please reconnect HMRC first.");
  }

  return record.access_token || record.hmrc_access_token;
}

function hmrcHeaders(accessToken: string, correlationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.hmrc.8.0+json",
    "Content-Type": "application/json",
    "X-Correlation-ID": correlationId,
  };
}

async function parseHmrcResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function callHmrc(
  path: string,
  method: "GET" | "POST" | "PUT",
  accessToken: string,
  correlationId: string,
  payload?: any
) {
  const url = `${HMRC_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: hmrcHeaders(accessToken, correlationId),
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
    });
  } catch (fetchErr: any) {
    const error: any = new Error(
      `HMRC network fetch failed. URL: ${url}. Detail: ${getErrorText(fetchErr)}`
    );
    error.hmrcResponse = {
      url,
      method,
      networkError: true,
      detail: getErrorText(fetchErr),
      baseUrl: HMRC_BASE_URL,
    };
    throw error;
  }

  const data = await parseHmrcResponse(response);

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      data?.failures?.[0]?.message ||
      data?.code ||
      `HMRC request failed with status ${response.status}`;

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.hmrcResponse = {
      url,
      method,
      status: response.status,
      body: data,
    };
    throw error;
  }

  return data;
}

export async function POST(req: Request) {
  let submissionRowId: string | null = null;

  try {
    const body = await req.json();

    const firmId = body.firmId;
    const clientId = body.clientId;
    const taxYearId = body.taxYearId;
    const userId = body.userId || null;
    const isAmendment = Boolean(body.isAmendment);
    const amendmentReason = body.amendmentReason || null;

    if (!firmId || !clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from("final_declaration_workflows")
      .select("*")
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    if (workflowError) {
      return NextResponse.json(
        { success: false, error: workflowError.message },
        { status: 500 }
      );
    }

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: "Final declaration workflow has not been initialised." },
        { status: 400 }
      );
    }

    if (workflow.status === "submitted" && !isAmendment) {
      return NextResponse.json(
        { success: false, error: "Final declaration has already been submitted." },
        { status: 400 }
      );
    }

    if (!workflow.accountant_approved) {
      return NextResponse.json(
        { success: false, error: "Accountant approval is required before final submission." },
        { status: 400 }
      );
    }

    if (!workflow.ready_to_submit) {
      return NextResponse.json(
        {
          success: false,
          error: "Final declaration is not ready to submit.",
          readinessChecks: workflow.readiness_checks,
        },
        { status: 400 }
      );
    }

    const { nino, taxYearLabel } = await getClientAndTaxYear(clientId, taxYearId);
    const accessToken = await getHmrcAccessToken(firmId, clientId);

    const correlationId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `corr-${Date.now()}`;

    const requestPayload = {
      baseUrl: HMRC_BASE_URL,
      nino,
      taxYear: taxYearLabel,
      calculationType: "intent-to-finalise",
      annualIncome: workflow.annual_income || 0,
      annualExpenses: workflow.annual_expenses || 0,
      isAmendment,
      amendmentReason,
    };

    const { data: submissionRow, error: insertError } = await supabaseAdmin
      .from("final_declaration_hmrc_submissions")
      .insert({
        firm_id: firmId,
        client_id: clientId,
        tax_year_id: taxYearId,
        final_declaration_id: workflow.id,
        nino,
        tax_year: taxYearLabel,
        hmrc_correlation_id: correlationId,
        request_payload: requestPayload,
        status: "submitting",
        attempt_count: 1,
        last_attempt_at: new Date().toISOString(),
        is_amendment: isAmendment,
        amendment_reason: amendmentReason,
        submitted_by: userId,
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    submissionRowId = submissionRow.id;

    await updateWorkflow({
      action: "mark_submitting",
      firmId,
      clientId,
      taxYearId,
      userId,
      annualIncome: workflow.annual_income,
      annualExpenses: workflow.annual_expenses,
      notes: "Real HMRC final declaration submission started.",
    });

    const triggerPath = `/individuals/calculations/${nino}/self-assessment/${taxYearLabel}/trigger/intent-to-finalise`;

    const triggerResponse = await callHmrc(
      triggerPath,
      "POST",
      accessToken,
      correlationId,
      {}
    );

    const calculationId =
      triggerResponse?.calculationId ||
      triggerResponse?.id ||
      triggerResponse?.calculationReference;

    if (!calculationId) {
      throw new Error("HMRC did not return a calculation ID.");
    }

    await supabaseAdmin
      .from("final_declaration_hmrc_submissions")
      .update({
        calculation_id: calculationId,
        calculation_status: "triggered",
        calculation_response: triggerResponse,
        response_payload: triggerResponse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionRowId);

    const retrievePath = `/individuals/calculations/${nino}/self-assessment/${taxYearLabel}/${calculationId}`;

    const calculationResponse = await callHmrc(
      retrievePath,
      "GET",
      accessToken,
      correlationId
    );

    await supabaseAdmin
      .from("final_declaration_hmrc_submissions")
      .update({
        calculation_status: "retrieved",
        calculation_response: calculationResponse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionRowId);

    const finalResponse = calculationResponse;

const hmrcFinalSubmissionId = calculationId;

    await supabaseAdmin
      .from("final_declaration_hmrc_submissions")
      .update({
        hmrc_submission_id: hmrcFinalSubmissionId,
        response_payload: finalResponse,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionRowId);

    await updateWorkflow({
      action: "mark_submitted",
      firmId,
      clientId,
      taxYearId,
      userId,
      annualIncome: workflow.annual_income,
      annualExpenses: workflow.annual_expenses,
      hmrcFinalSubmissionId,
      notes: "Real HMRC final declaration submitted and locked.",
    });

    return NextResponse.json({
      success: true,
      status: "submitted",
      calculationId,
      hmrcFinalSubmissionId,
      correlationId,
    });
  } catch (err: any) {
    const errorMessage = getErrorText(err);

    if (submissionRowId) {
      await supabaseAdmin
        .from("final_declaration_hmrc_submissions")
        .update({
          status: "retry_pending",
          error_code: err?.hmrcResponse?.body?.code || err?.status || err?.code || null,
          error_message: errorMessage,
          response_payload: err?.hmrcResponse || null,
          next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionRowId);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hmrcResponse: err?.hmrcResponse || null,
      },
      { status: 500 }
    );
  }
}