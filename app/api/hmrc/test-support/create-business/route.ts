import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../../lib/hmrc/getValidHmrcToken";
import { hmrcRequest } from "../../../../../lib/hmrc/client";
import {
  getAuthenticatedUserFromRequest,
  assertClientAccess,
} from "../../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";

type TestBusinessType =
  | "self-employment"
  | "uk-property"
  | "foreign-property"
  | "property-unspecified";

function cleanNino(nino: string) {
  return String(nino || "").replace(/\s+/g, "").toUpperCase();
}

function canonicalSourceType(type: string) {
  if (type === "self-employment") return "self_employment";
  if (type === "uk-property") return "uk_property";
  if (type === "foreign-property") return "foreign_property";
  return "property_unspecified";
}

function defaultBusinessPayload(typeOfBusiness: TestBusinessType) {
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId || body.client_id;
    const typeOfBusiness = body.typeOfBusiness as TestBusinessType;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId required" },
        { status: 400 }
      );
    }

    if (
      ![
        "self-employment",
        "uk-property",
        "foreign-property",
        "property-unspecified",
      ].includes(typeOfBusiness)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "typeOfBusiness must be self-employment, uk-property, foreign-property, or property-unspecified",
        },
        { status: 400 }
      );
    }

    if (process.env.HMRC_ENVIRONMENT === "production") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Self Assessment Test Support API is sandbox-only and must never run in production.",
        },
        { status: 403 }
      );
    }

    const client = await assertClientAccess({
      userId: user.id,
      userEmail: user.email,
      clientId,
      allowHalaAdmin: false,
    });

    const nino = cleanNino(client.nino || body.nino || "");

    if (!nino) {
      return NextResponse.json(
        { success: false, error: "Client NINO is missing" },
        { status: 400 }
      );
    }

    const accessToken = await getValidHmrcToken(client.firm_id);

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "No valid HMRC access token found" },
        { status: 401 }
      );
    }

    const hmrcPayload = {
      ...defaultBusinessPayload(typeOfBusiness),
      ...(body.hmrcPayload || {}),
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

    if (!hmrcResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: "HMRC test business creation failed",
          status: hmrcResponse.status,
          correlationId: hmrcResponse.correlationId,
          hmrcPayload,
          hmrcResponse: hmrcResponse.data,
        },
        { status: hmrcResponse.status || 502 }
      );
    }

    const businessId =
      hmrcResponse.data?.businessId ||
      hmrcResponse.data?.incomeSourceId ||
      hmrcResponse.data?.id ||
      null;

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "HMRC created test business but did not return a businessId in the expected field.",
          correlationId: hmrcResponse.correlationId,
          hmrcPayload,
          hmrcResponse: hmrcResponse.data,
        },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    const sourceType = canonicalSourceType(typeOfBusiness);

    const { data: incomeSource, error: upsertError } = await supabaseAdmin
      .from("hmrc_income_sources")
      .upsert(
        {
          firm_id: client.firm_id,
          client_id: client.id,
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
            createdByRoute: "/api/hmrc/test-support/create-business",
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
      return NextResponse.json(
        {
          success: false,
          error: upsertError.message,
          hmrcBusinessCreated: true,
          businessId,
          hmrcResponse: hmrcResponse.data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "HMRC sandbox stateful test business created and stored.",
      firmId: client.firm_id,
      clientId: client.id,
      nino,
      typeOfBusiness,
      canonicalSourceType: sourceType,
      businessId,
      incomeSourceId: incomeSource.id,
      correlationId: hmrcResponse.correlationId,
      hmrcPayload,
      hmrcResponse: hmrcResponse.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
