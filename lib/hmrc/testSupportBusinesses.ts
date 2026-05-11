import { supabaseAdmin } from "../supabaseAdmin";
import { hmrcRequest } from "./client";

export type TestBusinessType =
  | "self-employment"
  | "uk-property"
  | "foreign-property"
  | "property-unspecified";

export function cleanNino(nino: string) {
  return String(nino || "").replace(/\s+/g, "").toUpperCase();
}

export function canonicalSourceType(type: string) {
  if (type === "self-employment") return "self_employment";
  if (type === "uk-property") return "uk_property";
  if (type === "foreign-property") return "foreign_property";
  return "property_unspecified";
}

export function defaultBusinessPayload(typeOfBusiness: TestBusinessType) {
  const isProperty = typeOfBusiness.includes("property");

  return {
    typeOfBusiness,
    ...(isProperty ? {} : { tradingName: "Hala Test Trade" }),

    firstAccountingPeriodStartDate: "2025-04-06",
    firstAccountingPeriodEndDate: "2026-04-05",

    latencyDetails: {
      latencyEndDate: "2025-04-06",
      taxYear1: "2025-26",
      latencyIndicator1: "Q",
      taxYear2: "2026-27",
      latencyIndicator2: "Q",
    },

    quarterlyTypeChoice: {
      quarterlyPeriodType: "standard",
      taxYearOfChoice: "2025-26",
    },

    accountingType: "CASH",
    commencementDate: "2025-04-06",

    ...(isProperty
      ? {}
      : {
          businessAddressLineOne: "1 Test Street",
          businessAddressLineTwo: "London",
          businessAddressPostcode: "SW1A 1AA",
          businessAddressCountryCode: "GB",
        }),
  };
}

export async function createSandboxTestBusiness(params: {
  accessToken: string;
  firmId: string;
  clientId: string;
  nino: string;
  typeOfBusiness: TestBusinessType;
  overridePayload?: Record<string, any>;
}) {
  const { accessToken, firmId, clientId, nino, typeOfBusiness } = params;

  const hmrcPayload = {
    ...defaultBusinessPayload(typeOfBusiness),
    ...(params.overridePayload || {}),
    typeOfBusiness,
  };

  const hmrcResponse = await hmrcRequest({
    accessToken,
    endpoint: `/individuals/self-assessment-test-support/business/${nino}`,
    method: "POST",
    body: hmrcPayload,
    acceptHeader: "application/vnd.hmrc.1.0+json",
    testScenario: null,
  });

  const businessId =
    hmrcResponse.data?.businessId ||
    hmrcResponse.data?.incomeSourceId ||
    hmrcResponse.data?.id ||
    null;

  if (!hmrcResponse.success || !businessId) {
    return {
      success: false,
      status: hmrcResponse.status,
      typeOfBusiness,
      businessId,
      correlationId: hmrcResponse.correlationId,
      hmrcPayload,
      hmrcResponse: hmrcResponse.data,
      error:
        hmrcResponse.data?.message ||
        hmrcResponse.data?.code ||
        "HMRC test business creation failed",
    };
  }

  const now = new Date().toISOString();
  const sourceType = canonicalSourceType(typeOfBusiness);

  const { data: incomeSource, error: upsertError } = await supabaseAdmin
    .from("hmrc_income_sources")
    .upsert(
      {
        firm_id: firmId,
        client_id: clientId,
        hmrc_business_id: businessId,
        type_of_business: sourceType,
        canonical_source_type: sourceType,
        source_name: typeOfBusiness,
        display_name: typeOfBusiness,
        accounting_type: hmrcPayload.accountingType || "CASH",
        active: true,
        source_status: "hmrc_matched",
        hmrc_evidence_status: "verified",
        first_seen_from: "hmrc_test_support_create_business",
        last_seen_at: now,
        last_hmrc_sync_at: now,
        raw_source: {
          hmrcPayload,
          hmrcResponse: hmrcResponse.data,
          correlationId: hmrcResponse.correlationId,
          createdVia: "self_assessment_test_support_api",
        },
        sync_source: "hmrc_test_support_create_business",
        environment: "sandbox",
        metadata: {
          sandboxStatefulBusiness: true,
          createdAt: now,
          businessId,
          typeOfBusiness,
        },
        updated_at: now,
      },
      {
        onConflict: "firm_id,client_id,hmrc_business_id,canonical_source_type",
      }
    )
    .select("*")
    .single();

  if (upsertError) {
    return {
      success: false,
      status: 500,
      typeOfBusiness,
      businessId,
      correlationId: hmrcResponse.correlationId,
      hmrcPayload,
      hmrcResponse: hmrcResponse.data,
      error: upsertError.message,
    };
  }

  return {
    success: true,
    status: hmrcResponse.status,
    typeOfBusiness,
    canonicalSourceType: sourceType,
    businessId,
    incomeSourceId: incomeSource.id,
    correlationId: hmrcResponse.correlationId,
    hmrcPayload,
    hmrcResponse: hmrcResponse.data,
  };
}