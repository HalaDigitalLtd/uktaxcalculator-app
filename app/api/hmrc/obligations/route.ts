import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../lib/hmrc/getValidHmrcToken";
import {
  getAuthenticatedUserFromRequest,
  assertClientAccess,
} from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

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

function canonicalSourceType(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function getTaxYearLabelFromEndDate(endDate: string) {
  const endYear = new Date(endDate).getFullYear();
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

function getClientDisplayName(client: Row) {
  return (
    `${client?.first_name || ""} ${client?.last_name || ""}`.trim() ||
    client?.business_name ||
    client?.email ||
    client?.client_email ||
    "HMRC Client"
  );
}

function getObligationBusinesses(hmrcData: Row) {
  return Array.isArray(hmrcData?.obligations) ? hmrcData.obligations : [];
}

function getPrimaryBusiness(hmrcData: Row) {
  return getObligationBusinesses(hmrcData)[0] || null;
}

function buildProfileWarnings(client: Row, hmrcData: Row) {
  const warnings: string[] = [];
  const businesses = getObligationBusinesses(hmrcData);

  if (!client?.nino) warnings.push("Client NINO is missing.");
  if (!client?.utr) warnings.push("Client UTR is missing.");
  if (!client?.mtd_income_tax_id) {
    warnings.push("MTD Income Tax ID is not stored on the client profile.");
  }

  if (businesses.length === 0) {
    warnings.push("No HMRC income sources were detected from obligations.");
  }

  if (!client?.business_name) {
    warnings.push("Business/full name is not stored on the client profile.");
  }

  if (!client?.postcode) {
    warnings.push("Postcode is not stored on the client profile.");
  }

  return warnings;
}

async function saveIncomeSources(params: {
  firmId: string;
  clientId: string;
  hmrcData: Row;
  correlationId: string | null;
  testScenario: string;
}) {
  const { firmId, clientId, hmrcData, correlationId, testScenario } = params;

  const businesses = getObligationBusinesses(hmrcData);
  let saved = 0;
  let failed = 0;

  for (const business of businesses) {
    const businessId = business?.businessId;
    const typeOfBusiness = business?.typeOfBusiness;

    if (!businessId || !typeOfBusiness) {
      failed++;
      continue;
    }

    const payload = {
      firm_id: firmId,
      client_id: clientId,
      hmrc_business_id: businessId,
      type_of_business: canonicalSourceType(typeOfBusiness),
      canonical_source_type: canonicalSourceType(typeOfBusiness),
      source_name: typeOfBusiness,
      active: true,
      last_seen_at: new Date().toISOString(),
      raw_source: {
        ...business,
        correlationId,
        testScenario,
      },
      sync_source: "hmrc_obligations_sync",
      environment: process.env.HMRC_ENVIRONMENT || "sandbox",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("hmrc_income_sources")
      .upsert(payload, {
        onConflict: "client_id,hmrc_business_id,type_of_business",
      });

    if (error) {
      failed++;
      console.error("HMRC income source save failed:", error);
    } else {
      saved++;
    }
  }

  return { saved, failed };
}

async function saveHmrcProfileSnapshot(params: {
  client: Row;
  user: Row;
  hmrcData: Row;
  correlationId: string | null;
  testScenario: string;
}) {
  const { client, user, hmrcData, correlationId, testScenario } = params;

  const businesses = getObligationBusinesses(hmrcData);
  const primaryBusiness = getPrimaryBusiness(hmrcData);

  const detectedIncomeSources = businesses.map((business: Row) => ({
    businessId: business?.businessId || null,
    typeOfBusiness: business?.typeOfBusiness || null,
    canonicalSourceType: canonicalSourceType(business?.typeOfBusiness),
    obligationCount: Array.isArray(business?.obligationDetails)
      ? business.obligationDetails.length
      : 0,
  }));

  const primaryBusinessId =
    primaryBusiness?.businessId || client.hmrc_business_id || null;

  const primaryIncomeSourceType =
    primaryBusiness?.typeOfBusiness || client.hmrc_income_source_type || null;

  const warnings = buildProfileWarnings(client, hmrcData);

  const profileSnapshot = {
    source: "hmrc_obligations_sync",
    testScenario,
    correlationId,
    obligationsBusinessCount: businesses.length,
    detectedIncomeSources,
    primaryBusinessId,
    primaryIncomeSourceType,
    clientProfileAtSync: {
      id: client.id,
      firm_id: client.firm_id,
      first_name: client.first_name,
      last_name: client.last_name,
      business_name: client.business_name,
      email: client.email || client.client_email,
      nino: client.nino,
      utr: client.utr,
      mtd_income_tax_id: client.mtd_income_tax_id,
      vat_registration_number: client.vat_registration_number,
      vat_registration_date: client.vat_registration_date,
      eori_number: client.eori_number,
      group_identifier: client.group_identifier,
      hmrc_user_id: client.hmrc_user_id,
      date_of_birth: client.date_of_birth,
      address_line1: client.address_line1,
      address_line2: client.address_line2,
      city: client.city,
      postcode: client.postcode,
    },
    hmrcObligationsResponse: hmrcData,
  };

  await supabaseAdmin.from("hmrc_profile_snapshots").insert({
    firm_id: client.firm_id,
    client_id: client.id,
    source: "hmrc_obligations_sync",
    environment: process.env.HMRC_ENVIRONMENT || "sandbox",

    hmrc_user_id: client.hmrc_user_id || null,
    group_identifier: client.group_identifier || null,
    nino: client.nino || null,
    utr: client.utr || null,
    mtd_income_tax_id: client.mtd_income_tax_id || null,
    vat_registration_number: client.vat_registration_number || null,
    vat_registration_date: client.vat_registration_date || null,
    eori_number: client.eori_number || null,

    full_name: getClientDisplayName(client),
    first_name: client.first_name || null,
    last_name: client.last_name || null,
    date_of_birth: client.date_of_birth || null,
    address_line1: client.address_line1 || null,
    address_line2: client.address_line2 || null,
    city: client.city || null,
    postcode: client.postcode || null,

    raw_profile: profileSnapshot,
    raw_identity: {
      source: "client_profile_plus_hmrc_obligations",
      correlationId,
      detectedIncomeSources,
    },
    raw_vat_profile: {
      vat_registration_number: client.vat_registration_number || null,
      vat_registration_date: client.vat_registration_date || null,
      eori_number: client.eori_number || null,
      note:
        "VAT/EORI values are preserved from client/test-user profile. Dedicated VAT API hydration should be added only when VAT scopes/endpoints are enabled.",
    },
    raw_itsa_profile: {
      primaryBusinessId,
      primaryIncomeSourceType,
      detectedIncomeSources,
      mtdIncomeTaxId: client.mtd_income_tax_id || null,
      obligations: businesses,
    },

    sync_status: warnings.length > 0 ? "synced_with_warnings" : "synced",
    sync_warnings: warnings,
    mismatch_report: {
      warnings,
      primaryBusinessId,
      primaryIncomeSourceType,
      detectedIncomeSources,
    },

    synced_by: user.id,
    synced_by_email: user.email || null,
  });

  const updatePayload: Row = {
    hmrc_connected: true,
    hmrc_authorisation_status: "authorised",
    mtd_status: "authorised",
    hmrc_environment: process.env.HMRC_ENVIRONMENT || "sandbox",
    updated_at: new Date().toISOString(),
  };

  if (primaryBusinessId) updatePayload.hmrc_business_id = primaryBusinessId;
  if (primaryIncomeSourceType) {
    updatePayload.hmrc_income_source_type = primaryIncomeSourceType;
  }

  await supabaseAdmin
    .from("clients")
    .update(updatePayload)
    .eq("id", client.id)
    .eq("firm_id", client.firm_id);

  return {
    warnings,
    primaryBusinessId,
    primaryIncomeSourceType,
    detectedIncomeSources,
  };
}

async function saveObligations(params: {
  firmId: string;
  clientId: string;
  hmrcData: Row;
  correlationId: string | null;
}) {
  const { firmId, clientId, hmrcData, correlationId } = params;

  let saved = 0;
  let failed = 0;

  for (const business of getObligationBusinesses(hmrcData)) {
    const businessId = business?.businessId;
    const typeOfBusiness = business?.typeOfBusiness;

    if (!businessId || !typeOfBusiness) {
      failed++;
      continue;
    }

    for (const obligation of business.obligationDetails || []) {
      const periodKey =
        `${typeOfBusiness}_${businessId}_${obligation.periodStartDate}_${obligation.periodEndDate}`;

      const payload = {
        client_id: clientId,
        firm_id: firmId,

        hmrc_business_id: businessId,
        hmrc_business_type: typeOfBusiness,

        period_key: periodKey,
        start_date: obligation.periodStartDate,
        end_date: obligation.periodEndDate,
        due_date: obligation.dueDate,
        status: obligation.status,

        hmrc_source: typeOfBusiness,
        hmrc_obligation_id:
          `${businessId}_${obligation.periodStartDate}_${obligation.periodEndDate}`,

        hmrc_response: {
          ...obligation,
          businessId,
          typeOfBusiness,
          canonicalSourceType: canonicalSourceType(typeOfBusiness),
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

async function provisionQuarterIncomeSources(params: {
  firmId: string;
  clientId: string;
}) {
  const { firmId, clientId } = params;

  const { data: obligations, error: obligationsError } = await supabaseAdmin
    .from("obligations")
    .select(
      "id, client_id, firm_id, hmrc_source, hmrc_business_id, hmrc_business_type, start_date, end_date, status"
    )
    .eq("client_id", clientId)
    .eq("firm_id", firmId)
    .not("hmrc_business_id", "is", null)
    .order("start_date", { ascending: true });

  if (obligationsError) {
    console.error("Quarter income source provisioning obligations load failed:", obligationsError);
    return {
      created: 0,
      skipped: 0,
      failed: 0,
      error: obligationsError.message,
    };
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const obligation of obligations || []) {
    const sourceType = canonicalSourceType(obligation.hmrc_business_type || obligation.hmrc_source);

    const { data: taxYear, error: taxYearError } = await supabaseAdmin
      .from("tax_years")
      .select("id")
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .lte("start_date", obligation.start_date)
      .gte("end_date", obligation.end_date)
      .maybeSingle();

    if (taxYearError || !taxYear?.id) {
      failed++;
      console.error("Tax year missing for obligation:", {
        obligationId: obligation.id,
        taxYearError,
      });
      continue;
    }

    const { data: quarter, error: quarterError } = await supabaseAdmin
      .from("quarters")
      .select("id")
      .eq("tax_year_id", taxYear.id)
      .eq("firm_id", firmId)
      .eq("start_date", obligation.start_date)
      .eq("end_date", obligation.end_date)
      .maybeSingle();

    if (quarterError || !quarter?.id) {
      failed++;
      console.error("Quarter missing for obligation:", {
        obligationId: obligation.id,
        quarterError,
      });
      continue;
    }

    const { data: incomeSource, error: incomeSourceError } = await supabaseAdmin
      .from("hmrc_income_sources")
      .select(
        "id, hmrc_business_id, type_of_business, canonical_source_type, source_name, trading_name, accounting_type"
      )
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .eq("hmrc_business_id", obligation.hmrc_business_id)
      .eq("canonical_source_type", sourceType)
      .maybeSingle();

    if (incomeSourceError) {
      failed++;
      console.error("HMRC income source lookup failed:", {
        obligationId: obligation.id,
        incomeSourceError,
      });
      continue;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("quarter_income_sources")
      .select("id")
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .eq("quarter_id", quarter.id)
      .eq("obligation_id", obligation.id)
      .eq("hmrc_business_id", obligation.hmrc_business_id)
      .maybeSingle();

    if (existingError) {
      failed++;
      console.error("Quarter income source duplicate check failed:", existingError);
      continue;
    }

    if (existing?.id) {
      skipped++;
      continue;
    }

    const evidenceVerified = Boolean(incomeSource?.id);

    const insertPayload = {
      firm_id: firmId,
      client_id: clientId,
      tax_year_id: taxYear.id,
      quarter_id: quarter.id,
      obligation_id: obligation.id,

      hmrc_source: obligation.hmrc_source,
      hmrc_business_id: obligation.hmrc_business_id,
      canonical_source_type: sourceType,
      hmrc_income_source_id: incomeSource?.id || null,

      period_start: obligation.start_date,
      period_end: obligation.end_date,

      status: "not_started",
      income: 0,
      expenses: 0,
      profit: 0,

      source_evidence_status: evidenceVerified ? "verified" : "unverified",
            source_evidence_snapshot:
        evidenceVerified && incomeSource
          ? {
              hmrc_income_source_id: incomeSource.id,
              hmrc_business_id: incomeSource.hmrc_business_id,
              canonical_source_type: incomeSource.canonical_source_type,
              type_of_business: incomeSource.type_of_business,
              source_name: incomeSource.source_name,
              trading_name: incomeSource.trading_name,
              accounting_type: incomeSource.accounting_type,
              verified_at: new Date().toISOString(),
              verification_method:
                "sync_route_provision_from_hmrc_obligation_and_income_source",
            }
          : {},

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from("quarter_income_sources")
      .insert(insertPayload);

    if (insertError) {
      failed++;
      console.error("Quarter income source insert failed:", insertError);
    } else {
      created++;
    }
  }

  return {
    created,
    skipped,
    failed,
    error: null,
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

    const accessToken = await getValidHmrcToken(client.firm_id);

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "HMRC connection not found. Please connect this firm/client to HMRC first.",
          code: "HMRC_CONNECTION_REQUIRED",
          connectRequired: true,
          firmId: client.firm_id,
          clientId: client.id,
        },
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

    const incomeSourceSync = await saveIncomeSources({
      firmId: client.firm_id,
      clientId: client.id,
      hmrcData: data,
      correlationId,
      testScenario,
    });

    const { saved, failed } = await saveObligations({
      firmId: client.firm_id,
      clientId: client.id,
      hmrcData: data,
      correlationId,
    });

    const profileSync = await saveHmrcProfileSnapshot({
      client,
      user,
      hmrcData: data,
      correlationId,
      testScenario,
    });

    const {
      provisionResult,
      matchResult,
      provisionErrorMessage,
      matchErrorMessage,
    } = await runProvisioning(client.id);

    const quarterIncomeSourceProvisioning = await provisionQuarterIncomeSources({
      firmId: client.firm_id,
      clientId: client.id,
    });

    const detectedTaxYears = Array.from(
      new Set(
        getObligationBusinesses(data).flatMap((business: any) =>
          (business.obligationDetails || []).map((obligation: any) =>
            getTaxYearLabelFromEndDate(obligation.periodEndDate)
          )
        )
      )
    );

    return NextResponse.json({
      success: true,
      message:
        "HMRC obligations, income sources and source-level client workspace synced successfully.",
      firmId: client.firm_id,
      clientId: client.id,
      clientName: getClientDisplayName(client),
      nino,

      saved,
      failed,

      incomeSourcesSaved: incomeSourceSync.saved,
      incomeSourcesFailed: incomeSourceSync.failed,

      detectedTaxYears,
      detectedIncomeSources: profileSync.detectedIncomeSources,

      matched: matchResult?.matched ?? matchResult?.[0]?.matched ?? 0,
      createdTaxYears:
        provisionResult?.created_tax_years ??
        provisionResult?.[0]?.created_tax_years ??
        0,
      createdQuarters:
        provisionResult?.created_quarters_attempted ??
        provisionResult?.[0]?.created_quarters_attempted ??
        0,

      quarterIncomeSourcesCreated: quarterIncomeSourceProvisioning.created,
      quarterIncomeSourcesSkipped: quarterIncomeSourceProvisioning.skipped,
      quarterIncomeSourcesFailed: quarterIncomeSourceProvisioning.failed,
      quarterIncomeSourceProvisioningWarning:
        quarterIncomeSourceProvisioning.error,

      provisionWarning: provisionErrorMessage,
      matchWarning: matchErrorMessage,
      correlationId,
      profileSync,
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