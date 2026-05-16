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
  const normalised = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (normalised === "self_employment") return "self_employment";
  if (normalised === "uk_property") return "uk_property";
  if (normalised === "foreign_property") return "foreign_property";
  if (normalised === "foreign_income") return "foreign_income";
  if (normalised === "partnership") return "partnership";

  return normalised || "other";
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

function getTaxYearLabelFromEndDate(endDate: string) {
  const endYear = new Date(endDate).getFullYear();
  const startYear = endYear - 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
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

async function writeIncomeSourceAudit(params: {
  incomeSourceId: string;
  firmId: string;
  clientId: string;
  action:
    | "created"
    | "updated"
    | "hmrc_matched"
    | "manually_confirmed"
    | "status_changed"
    | "conflict_detected"
    | "closed"
    | "metadata_updated";
  fromValues?: Row | null;
  toValues?: Row | null;
  performedBy?: string | null;
  performedRole?: string | null;
  reason?: string | null;
}) {
  const { error } = await supabaseAdmin.from("hmrc_income_source_audit").insert({
    income_source_id: params.incomeSourceId,
    firm_id: params.firmId,
    client_id: params.clientId,
    action: params.action,
    from_values: params.fromValues || null,
    to_values: params.toValues || null,
    performed_by: params.performedBy || null,
    performed_role: params.performedRole || null,
    reason: params.reason || null,
  });

  if (error) {
    console.error("HMRC income source audit write failed:", error);
  }
}

async function resolveCanonicalIncomeSource(params: {
  firmId: string;
  clientId: string;
  business: Row;
  correlationId: string | null;
  testScenario: string;
  performedBy?: string | null;
}) {
  const {
    firmId,
    clientId,
    business,
    correlationId,
    testScenario,
    performedBy,
  } = params;

  const businessId = business?.businessId;
  const typeOfBusiness = business?.typeOfBusiness;
  const sourceType = canonicalSourceType(typeOfBusiness);

  if (!businessId || !typeOfBusiness) {
    return {
      incomeSource: null as Row | null,
      created: false,
      updated: false,
      error: "Missing HMRC businessId or typeOfBusiness.",
    };
  }

  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("hmrc_income_sources")
    .select("*")
    .eq("firm_id", firmId)
    .eq("client_id", clientId)
    .eq("hmrc_business_id", businessId)
    .eq("canonical_source_type", sourceType)
    .maybeSingle();

  if (existingError) {
    console.error("Canonical income source lookup failed:", existingError);
    return {
      incomeSource: null as Row | null,
      created: false,
      updated: false,
      error: existingError.message,
    };
  }

  const payload: Row = {
    firm_id: firmId,
    client_id: clientId,

    hmrc_business_id: businessId,
    hmrc_income_source_id: existing?.hmrc_income_source_id || null,

    type_of_business: sourceType,
    canonical_source_type: sourceType,
    source_name: typeOfBusiness,
    display_name:
      existing?.display_name ||
      business?.tradingName ||
      business?.businessName ||
      typeOfBusiness,

    trading_name:
      business?.tradingName || business?.businessName || existing?.trading_name || null,
    business_description:
      business?.businessDescription || existing?.business_description || null,

    accounting_type: business?.accountingType || existing?.accounting_type || "unknown",
    active: true,

    source_status: "hmrc_matched",
    hmrc_evidence_status: "verified",
    first_seen_from: existing?.first_seen_from || "hmrc_obligations",
    last_seen_at: now,
    last_hmrc_sync_at: now,

    raw_source: {
      ...business,
      correlationId,
      testScenario,
    },
    sync_source: "official_obligation_engine",
    environment: process.env.HMRC_ENVIRONMENT || "sandbox",

    metadata: {
      ...(existing?.metadata || {}),
      latest_sync: {
        source: "official_obligation_engine",
        synced_at: now,
        correlationId,
        testScenario,
        businessId,
        typeOfBusiness,
        canonicalSourceType: sourceType,
      },
    },

    updated_at: now,
  };

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("hmrc_income_sources")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Canonical income source update failed:", updateError);
      return {
        incomeSource: null as Row | null,
        created: false,
        updated: false,
        error: updateError.message,
      };
    }

    await writeIncomeSourceAudit({
      incomeSourceId: existing.id,
      firmId,
      clientId,
      action: "hmrc_matched",
      fromValues: {
        source_status: existing.source_status,
        hmrc_evidence_status: existing.hmrc_evidence_status,
        last_hmrc_sync_at: existing.last_hmrc_sync_at,
      },
      toValues: {
        source_status: "hmrc_matched",
        hmrc_evidence_status: "verified",
        last_hmrc_sync_at: now,
      },
      performedBy,
      reason: "Official obligation engine refreshed canonical income source.",
    });

    return {
      incomeSource: updated,
      created: false,
      updated: true,
      error: null,
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("hmrc_income_sources")
    .insert({
      ...payload,
      created_at: now,
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Canonical income source insert failed:", insertError);
    return {
      incomeSource: null as Row | null,
      created: false,
      updated: false,
      error: insertError.message,
    };
  }

  await writeIncomeSourceAudit({
    incomeSourceId: inserted.id,
    firmId,
    clientId,
    action: "created",
    fromValues: null,
    toValues: {
      hmrc_business_id: businessId,
      canonical_source_type: sourceType,
      source_status: "hmrc_matched",
      hmrc_evidence_status: "verified",
    },
    performedBy,
    reason: "Official obligation engine created canonical income source.",
  });

  return {
    incomeSource: inserted,
    created: true,
    updated: false,
    error: null,
  };
}

async function saveIncomeSources(params: {
  firmId: string;
  clientId: string;
  hmrcData: Row;
  correlationId: string | null;
  testScenario: string;
  performedBy?: string | null;
}) {
  const { firmId, clientId, hmrcData, correlationId, testScenario, performedBy } =
    params;

  const businesses = getObligationBusinesses(hmrcData);
  let saved = 0;
  let failed = 0;
  let created = 0;
  let updated = 0;
  const sourceMap = new Map<string, Row>();

  for (const business of businesses) {
    const result = await resolveCanonicalIncomeSource({
      firmId,
      clientId,
      business,
      correlationId,
      testScenario,
      performedBy,
    });

    if (result.error || !result.incomeSource?.id) {
      failed++;
      continue;
    }

    saved++;
    if (result.created) created++;
    if (result.updated) updated++;

    sourceMap.set(business.businessId, result.incomeSource);
  }

  return { saved, failed, created, updated, sourceMap };
}

async function saveOfficialObligations(params: {
  firmId: string;
  clientId: string;
  hmrcData: Row;
  correlationId: string | null;
  sourceMap: Map<string, Row>;
  testScenario: string;
}) {
  const { firmId, clientId, hmrcData, correlationId, sourceMap, testScenario } =
    params;

  let saved = 0;
  let failed = 0;
  let created = 0;
  let updated = 0;
  const obligationMap = new Map<string, Row>();

  for (const business of getObligationBusinesses(hmrcData)) {
    const businessId = business?.businessId;
    const typeOfBusiness = business?.typeOfBusiness;
    const sourceType = canonicalSourceType(typeOfBusiness);
    const incomeSource = businessId ? sourceMap.get(businessId) : null;

    if (!businessId || !typeOfBusiness || !incomeSource?.id) {
      failed++;
      continue;
    }

    for (const obligation of business.obligationDetails || []) {
      const periodStart = obligation.periodStartDate;
      const periodEnd = obligation.periodEndDate;

      if (!periodStart || !periodEnd) {
        failed++;
        continue;
      }

      const now = new Date().toISOString();

      const payload = {
        firm_id: firmId,
        client_id: clientId,
        income_source_id: incomeSource.id,

        hmrc_business_id: businessId,
        canonical_source_type: sourceType,
        obligation_type: "quarterly",

        period_start: periodStart,
        period_end: periodEnd,
        due_date: obligation.dueDate || null,
        received_date: obligation.receivedDate || null,

        hmrc_status: obligation.status || "open",
        local_status: "synced",

        hmrc_obligation_detail: {
          ...obligation,
          businessId,
          typeOfBusiness,
          canonicalSourceType: sourceType,
          canonicalIncomeSourceId: incomeSource.id,
          sourceEvidenceStatus: incomeSource.hmrc_evidence_status,
          correlationId,
          testScenario,
        },

        sync_source: "official_obligation_engine",
        environment: process.env.HMRC_ENVIRONMENT || "sandbox",
        last_hmrc_sync_at: now,
        updated_at: now,
      };

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("hmrc_obligations")
        .select("*")
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .eq("income_source_id", incomeSource.id)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .eq("obligation_type", "quarterly")
        .maybeSingle();

      if (existingError) {
        failed++;
        console.error("Official obligation lookup failed:", existingError);
        continue;
      }

      if (existing?.id) {
        const { data: updatedRow, error: updateError } = await supabaseAdmin
          .from("hmrc_obligations")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateError) {
          failed++;
          console.error("Official obligation update failed:", updateError);
          continue;
        }

        saved++;
        updated++;
        obligationMap.set(
          `${businessId}_${periodStart}_${periodEnd}`,
          updatedRow
        );
        continue;
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("hmrc_obligations")
        .insert({
          ...payload,
          created_at: now,
        })
        .select("*")
        .single();

      if (insertError) {
        failed++;
        console.error("Official obligation insert failed:", insertError);
        continue;
      }

      saved++;
      created++;
      obligationMap.set(`${businessId}_${periodStart}_${periodEnd}`, inserted);
    }
  }

  return { saved, failed, created, updated, obligationMap };
}

async function mirrorLegacyObligations(params: {
  firmId: string;
  clientId: string;
  hmrcData: Row;
  correlationId: string | null;
  sourceMap: Map<string, Row>;
  obligationMap: Map<string, Row>;
}) {
  const { firmId, clientId, hmrcData, correlationId, sourceMap, obligationMap } =
    params;

  let saved = 0;
  let failed = 0;

  for (const business of getObligationBusinesses(hmrcData)) {
    const businessId = business?.businessId;
    const typeOfBusiness = business?.typeOfBusiness;
    const incomeSource = businessId ? sourceMap.get(businessId) : null;

    if (!businessId || !typeOfBusiness || !incomeSource?.id) {
      failed++;
      continue;
    }

    for (const obligation of business.obligationDetails || []) {
      const periodStart = obligation.periodStartDate;
      const periodEnd = obligation.periodEndDate;
      const officialObligation = obligationMap.get(
        `${businessId}_${periodStart}_${periodEnd}`
      );

      const periodKey = `${typeOfBusiness}_${businessId}_${periodStart}_${periodEnd}`;

      const payload = {
        client_id: clientId,
        firm_id: firmId,

        hmrc_business_id: businessId,
        hmrc_business_type: typeOfBusiness,
        hmrc_income_source_id: incomeSource.id,

        period_key: periodKey,
        start_date: periodStart,
        end_date: periodEnd,
        due_date: obligation.dueDate || null,
        status: obligation.status || "open",

        hmrc_source: typeOfBusiness,
        hmrc_obligation_id: `${businessId}_${periodStart}_${periodEnd}`,

        hmrc_response: {
          ...obligation,
          businessId,
          typeOfBusiness,
          canonicalSourceType: incomeSource.canonical_source_type,
          canonicalIncomeSourceId: incomeSource.id,
          officialObligationId: officialObligation?.id || null,
          sourceEvidenceStatus: incomeSource.hmrc_evidence_status,
          correlationId,
          mirroredFrom: "hmrc_obligations",
        },
      };

      const { error } = await supabaseAdmin.from("obligations").upsert(payload, {
        onConflict: "client_id,period_key,start_date,end_date",
      });

      if (error) {
        failed++;
        console.error("Legacy obligation mirror failed:", error);
      } else {
        saved++;
      }
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
    source: "official_obligation_engine",
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
    source: "official_obligation_engine",
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
      source: "client_profile_plus_official_obligation_engine",
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
      "Tax year and quarter provisioning failed:",
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
    console.error("Obligation-quarter matching failed:", matchError);
  } else {
    matchResult = matchData;
  }
const { data: qisaData, error: qisaError } = await supabaseAdmin.rpc(
  "provision_quarter_income_sources_from_official_obligations",
  {
    p_client_id: clientId,
  }
);

if (qisaError) {
  console.error(
    "Official quarter income source orchestration failed:",
    qisaError
  );
} else {
  console.log("Official quarter income source orchestration:", qisaData);
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
    .from("hmrc_obligations")
    .select(
      `
      id,
      client_id,
      firm_id,
      income_source_id,
      hmrc_business_id,
      canonical_source_type,
      period_start,
      period_end,
      due_date,
      hmrc_status,
      local_status,
      hmrc_obligation_detail
    `
    )
    .eq("client_id", clientId)
    .eq("firm_id", firmId)
    .order("period_start", { ascending: true });

  if (obligationsError) {
    console.error(
      "Official quarter income source provisioning load failed:",
      obligationsError
    );
    return {
      created: 0,
      skipped: 0,
      updated: 0,
      failed: 0,
      error: obligationsError.message,
    };
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let failed = 0;

  for (const obligation of obligations || []) {
    if (!obligation.income_source_id) {
      skipped++;
      continue;
    }

    const { data: taxYear, error: taxYearError } = await supabaseAdmin
      .from("tax_years")
      .select("id")
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .lte("start_date", obligation.period_start)
      .gte("end_date", obligation.period_end)
      .maybeSingle();

    if (taxYearError || !taxYear?.id) {
      failed++;
      console.error("Tax year missing for official obligation:", {
        officialObligationId: obligation.id,
        taxYearError,
      });
      continue;
    }

    const { data: quarter, error: quarterError } = await supabaseAdmin
      .from("quarters")
      .select("id")
      .eq("tax_year_id", taxYear.id)
      .eq("firm_id", firmId)
      .eq("start_date", obligation.period_start)
      .eq("end_date", obligation.period_end)
      .maybeSingle();

    if (quarterError || !quarter?.id) {
      failed++;
      console.error("Quarter missing for official obligation:", {
        officialObligationId: obligation.id,
        quarterError,
      });
      continue;
    }

    const { data: incomeSource, error: incomeSourceError } = await supabaseAdmin
      .from("hmrc_income_sources")
      .select(
        "id, hmrc_business_id, type_of_business, canonical_source_type, source_name, trading_name, accounting_type, display_name, source_status, hmrc_evidence_status"
      )
      .eq("id", obligation.income_source_id)
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .maybeSingle();

    if (incomeSourceError || !incomeSource?.id) {
      failed++;
      console.error("Canonical income source lookup failed:", {
        officialObligationId: obligation.id,
        incomeSourceError,
      });
      continue;
    }

    const { data: legacyObligation, error: legacyObligationError } =
      await supabaseAdmin
        .from("obligations")
        .select("id")
        .eq("client_id", clientId)
        .eq("firm_id", firmId)
        .eq("hmrc_business_id", obligation.hmrc_business_id)
        .eq("hmrc_income_source_id", incomeSource.id)
        .eq("start_date", obligation.period_start)
        .eq("end_date", obligation.period_end)
        .maybeSingle();

    if (legacyObligationError || !legacyObligation?.id) {
      failed++;
      console.error("Legacy compatibility obligation missing:", {
        officialObligationId: obligation.id,
        legacyObligationError,
        reason:
          "quarter_income_sources.obligation_id still references legacy obligations.id, while official_obligation_id stores the new engine id.",
      });
      continue;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("quarter_income_sources")
      .select("id")
      .eq("client_id", clientId)
      .eq("firm_id", firmId)
      .eq("quarter_id", quarter.id)
      .eq("official_obligation_id", obligation.id)
      .maybeSingle();

    if (existingError) {
      failed++;
      console.error("Quarter income source lookup failed:", existingError);
      continue;
    }

    const evidenceVerified = incomeSource.hmrc_evidence_status === "verified";
    const now = new Date().toISOString();

    const sourceSnapshot = {
      income_source_id: incomeSource.id,
      hmrc_business_id: incomeSource.hmrc_business_id,
      canonical_source_type: incomeSource.canonical_source_type,
      type_of_business: incomeSource.type_of_business,
      source_name: incomeSource.source_name,
      display_name: incomeSource.display_name,
      trading_name: incomeSource.trading_name,
      accounting_type: incomeSource.accounting_type,
      source_status: incomeSource.source_status,
      hmrc_evidence_status: incomeSource.hmrc_evidence_status,
      verified_at: now,
      verification_method: "official_obligation_engine",
    };

    const basePayload: Row = {
      firm_id: firmId,
      client_id: clientId,
      tax_year_id: taxYear.id,
      quarter_id: quarter.id,

      obligation_id: legacyObligation.id,
      official_obligation_id: obligation.id,

      income_source_id: incomeSource.id,
      hmrc_income_source_id: incomeSource.id,
      canonical_income_source_id: incomeSource.id,

      hmrc_source: obligation.canonical_source_type,
      hmrc_business_id: obligation.hmrc_business_id,
      canonical_source_type: obligation.canonical_source_type,

      period_start: obligation.period_start,
      period_end: obligation.period_end,
      due_date: obligation.due_date,

      hmrc_obligation_status: obligation.hmrc_status,
      source_evidence_status: evidenceVerified ? "verified" : "unverified",
      source_evidence_snapshot: sourceSnapshot,

      obligation_engine_status:
        obligation.hmrc_status === "fulfilled" ? "fulfilled" : "open",
      obligation_locked: obligation.hmrc_status === "fulfilled",
      obligation_locked_at:
        obligation.hmrc_status === "fulfilled" ? now : null,
      obligation_lock_reason:
        obligation.hmrc_status === "fulfilled"
          ? "HMRC obligation is already fulfilled."
          : null,

      updated_at: now,
    };

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("quarter_income_sources")
        .update(basePayload)
        .eq("id", existing.id);

      if (updateError) {
        failed++;
        console.error("Quarter income source update failed:", updateError);
      } else {
        updated++;
      }

      continue;
    }

    const insertPayload = {
      ...basePayload,
      status: "not_started",
      income: 0,
      expenses: 0,
      profit: 0,
      bookkeeping_status: "not_started",
      review_status: "not_started",
      submission_due_status: "open",
      deadline_metadata: {
        source: "official_obligation_engine",
        due_date: obligation.due_date,
        hmrc_status: obligation.hmrc_status,
        generated_at: now,
      },
      created_at: now,
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
    updated,
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

    const accessToken = await getValidHmrcToken(client.id);

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
      performedBy: user.id,
    });

    const officialObligationSync = await saveOfficialObligations({
      firmId: client.firm_id,
      clientId: client.id,
      hmrcData: data,
      correlationId,
      sourceMap: incomeSourceSync.sourceMap,
      testScenario,
    });

    const legacyMirror = await mirrorLegacyObligations({
      firmId: client.firm_id,
      clientId: client.id,
      hmrcData: data,
      correlationId,
      sourceMap: incomeSourceSync.sourceMap,
      obligationMap: officialObligationSync.obligationMap,
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
        "HMRC obligations synced through official obligation engine successfully.",

      firmId: client.firm_id,
      clientId: client.id,
      clientName: getClientDisplayName(client),
      nino,

      officialObligationsSaved: officialObligationSync.saved,
      officialObligationsCreated: officialObligationSync.created,
      officialObligationsUpdated: officialObligationSync.updated,
      officialObligationsFailed: officialObligationSync.failed,

      legacyObligationsMirrored: legacyMirror.saved,
      legacyObligationsMirrorFailed: legacyMirror.failed,

      incomeSourcesSaved: incomeSourceSync.saved,
      incomeSourcesCreated: incomeSourceSync.created,
      incomeSourcesUpdated: incomeSourceSync.updated,
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
      quarterIncomeSourcesUpdated: quarterIncomeSourceProvisioning.updated,
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
    console.error("Official HMRC obligation engine sync failed:", error);

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