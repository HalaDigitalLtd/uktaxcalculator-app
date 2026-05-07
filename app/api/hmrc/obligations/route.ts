import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import {
  getAuthenticatedUserFromRequest,
  assertClientAccess,
} from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";

function cleanNino(nino: string) {
  return String(nino || "").replace(/\s+/g, "").toUpperCase();
}

function safeJsonParse(text: string) {
  if (!text || !text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse: text,
      parseError: "Non-JSON response",
    };
  }
}

function getTaxYearLabelFromEndDate(endDate: string) {
  const endYear = new Date(endDate).getFullYear();
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

async function saveObligations(params: {
  firmId: string;
  clientId: string;
  hmrcData: any;
  correlationId: string | null;
}) {
  const { firmId, clientId, hmrcData, correlationId } = params;

  let saved = 0;
  let failed = 0;

  for (const business of hmrcData.obligations || []) {
    const businessId = business.businessId;
    const typeOfBusiness = business.typeOfBusiness;

    for (const obligation of business.obligationDetails || []) {
      const periodKey =
        `${typeOfBusiness}_` +
        `${businessId}_` +
        `${obligation.periodStartDate}_` +
        `${obligation.periodEndDate}`;

      const payload = {
        client_id: clientId,
        firm_id: firmId,
        period_key: periodKey,
        start_date: obligation.periodStartDate,
        end_date: obligation.periodEndDate,
        due_date: obligation.dueDate,
        status: obligation.status,
        hmrc_source: typeOfBusiness,
        hmrc_obligation_id:
          `${businessId}_` +
          `${obligation.periodStartDate}_` +
          `${obligation.periodEndDate}`,
        hmrc_response: {
          ...obligation,
          businessId,
          typeOfBusiness,
          correlationId,
        },
      };

      const { error } = await supabaseAdmin.from("obligations").upsert(payload, {
        onConflict: "client_id,period_key,start_date,end_date",
      });

      if (error) {
        failed++;
        console.error("Obligation save failed:", error);
      } else {
        saved++;
      }
    }
  }

  return { saved, failed };
}

async function runProvisioning(clientId: string) {
  let provisionResult: any = null;
  let matchResult: any = null;
  let provisionErrorMessage: string | null = null;
  let matchErrorMessage: string | null = null;

  const { data: provisionData, error: provisionError } =
    await supabaseAdmin.rpc("provision_quarters_from_obligations", {
      p_client_id: clientId,
    });

  if (provisionError) {
    provisionErrorMessage = provisionError.message;
    console.error(
      "Automatic tax year + quarter provisioning failed:",
      provisionError
    );
  } else {
    provisionResult = provisionData;
  }

  const { data: matchData, error: matchError } = await supabaseAdmin.rpc(
    "auto_match_obligations_to_quarters",
    {
      p_client_id: clientId,
    }
  );

  if (matchError) {
    matchErrorMessage = matchError.message;
    console.error("Automatic obligation-quarter matching failed:", matchError);
  } else {
    matchResult = matchData;
  }

  return {
    provisionResult,
    matchResult,
    provisionErrorMessage,
    matchErrorMessage,
  };
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

    const requestedClientId = body.clientId || body.client_id;
    const requestedNino = cleanNino(body.nino || body.niNumber || "");
    const testScenario = body.testScenario || "OPEN";

    if (!requestedClientId) {
      return NextResponse.json(
        { success: false, error: "clientId required." },
        { status: 400 }
      );
    }

    const client = await assertClientAccess({
      userId: user.id,
      userEmail: user.email,
      clientId: requestedClientId,
      allowHalaAdmin: false,
    });

    const nino = cleanNino(client.nino || requestedNino);

    if (!nino) {
      return NextResponse.json(
        { success: false, error: "Client NINO is missing." },
        { status: 400 }
      );
    }

    if (!client.hmrc_connected && !client.hmrc_access_token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Client is not marked as HMRC connected. Please complete HMRC connection first.",
        },
        { status: 400 }
      );
    }

    const accessToken = await getValidHmrcToken(client.firm_id);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "No valid HMRC access token found." },
        { status: 401 }
      );
    }

    const hmrcUrl = `https://test-api.service.hmrc.gov.uk/obligations/details/${nino}/income-and-expenditure`;

    const response = await fetch(hmrcUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.hmrc.3.0+json",
        "Gov-Test-Scenario": testScenario,
      },
      cache: "no-store",
    });

    const responseText = await response.text();
    const data = safeJsonParse(responseText);

    const correlationId =
      response.headers.get("x-correlationid") ||
      response.headers.get("X-CorrelationId") ||
      response.headers.get("x-correlation-id") ||
      null;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "HMRC API failed.",
          status: response.status,
          statusText: response.statusText,
          correlationId,
          hmrcUrl,
          hmrc: data,
          firmId: client.firm_id,
          clientId: client.id,
          nino,
        },
        { status: response.status }
      );
    }

    if (!data || !Array.isArray(data.obligations)) {
      return NextResponse.json(
        {
          success: false,
          error: "HMRC obligations response was empty or invalid.",
          status: response.status,
          correlationId,
          hmrcUrl,
          hmrc: data,
          firmId: client.firm_id,
          clientId: client.id,
          nino,
        },
        { status: 502 }
      );
    }

    const { saved, failed } = await saveObligations({
      firmId: client.firm_id,
      clientId: client.id,
      hmrcData: data,
      correlationId,
    });

    const {
      provisionResult,
      matchResult,
      provisionErrorMessage,
      matchErrorMessage,
    } = await runProvisioning(client.id);

    const detectedTaxYears = Array.from(
      new Set(
        (data.obligations || []).flatMap((business: any) =>
          (business.obligationDetails || []).map((obligation: any) =>
            getTaxYearLabelFromEndDate(obligation.periodEndDate)
          )
        )
      )
    );

    return NextResponse.json({
      success: true,
      message: "HMRC obligations synced and client workspace prepared.",
      firmId: client.firm_id,
      clientId: client.id,
      clientName: getClientDisplayName(client),
      nino,
      saved,
      failed,
      detectedTaxYears,
      matched: matchResult?.matched ?? matchResult?.[0]?.matched ?? 0,
      createdTaxYears:
        provisionResult?.created_tax_years ??
        provisionResult?.[0]?.created_tax_years ??
        0,
      createdQuarters:
        provisionResult?.created_quarters_attempted ??
        provisionResult?.[0]?.created_quarters_attempted ??
        0,
      provisionWarning: provisionErrorMessage,
      matchWarning: matchErrorMessage,
      correlationId,
    });
  } catch (error: any) {
    console.error("HMRC obligations sync failed:", error);

    const message = error?.message || "Unknown error.";

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

function getClientDisplayName(client: any) {
  return (
    `${client?.first_name || ""} ${client?.last_name || ""}`.trim() ||
    client?.email ||
    client?.client_email ||
    "HMRC Client"
  );
}