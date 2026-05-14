import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../../lib/hmrc/getValidHmrcToken";
import {
  cleanNino,
  createTestBusiness,
  hydrateHmrcBusinessIds,
  persistHmrcBusinessMappings,
  type CanonicalSourceType,
  type TestBusinessType,
} from "../../../../../lib/hmrc/testSupportBusinesses";

export const dynamic = "force-dynamic";

type Body = {
  clientId?: string;
  taxYearId?: string;
  taxYear?: string;
  nino?: string;
  includeSelfEmployment?: boolean;
  includeUkProperty?: boolean;
  includeForeignProperty?: boolean;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function deterministicSandboxBusinessId(canonicalType: CanonicalSourceType) {
  if (canonicalType === "uk_property") return "XPIS12345678901";
  if (canonicalType === "foreign_property") return "XFIS12345678901";
  return "XBIS12345678901";
}

async function getClient(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, nino, firm_id")
    .eq("id", clientId)
    .single();

  if (error) throw error;
  return data;
}

async function getTaxYear(taxYearId?: string, fallbackTaxYear?: string) {
  if (fallbackTaxYear) return fallbackTaxYear;
  if (!taxYearId) return "2026-27";

  const { data, error } = await supabaseAdmin
    .from("tax_years")
    .select("id, year_label")
    .eq("id", taxYearId)
    .single();

  if (error) throw error;
  return data.year_label;
}

async function runProvisioning(clientId: string) {
  const calls: any[] = [];

  for (const fn of [
    "provision_quarters_from_obligations",
    "provision_quarter_income_sources_from_official_obligations",
    "normalise_quarter_income_source_workflow_state",
  ]) {
    const { data, error } = await supabaseAdmin.rpc(fn, {
      p_client_id: clientId,
    });

    calls.push({ fn, result: data, error });
  }

  return calls;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!rawBody?.trim()) {
      return bad("Request body is empty");
    }

    const body = JSON.parse(rawBody) as Body;

    if (!body.clientId) {
      return bad("clientId is required");
    }

    const client = await getClient(body.clientId);
    const nino = cleanNino(body.nino || client.nino);

    if (!nino) {
      return bad("Client NINO missing");
    }

    const taxYear = await getTaxYear(body.taxYearId, body.taxYear);
    const accessToken = await getValidHmrcToken(body.clientId);

    const requestedTypes: TestBusinessType[] = [];

    if (body.includeSelfEmployment) requestedTypes.push("self-employment");
    if (body.includeUkProperty !== false) requestedTypes.push("uk-property");
    if (body.includeForeignProperty !== false) requestedTypes.push("foreign-property");

    const createResults: any[] = [];

    for (const typeOfBusiness of requestedTypes) {
      const result = await createTestBusiness({
        accessToken,
        nino,
        typeOfBusiness,
        taxYear,
      });

      createResults.push({ typeOfBusiness, ...result });

      if (!result.created && !result.alreadyExisted) {
        return NextResponse.json(
          {
            success: false,
            stage: "create-test-business",
            typeOfBusiness,
            result,
          },
          { status: 400 },
        );
      }
    }

    const hydration = await hydrateHmrcBusinessIds({
      accessToken,
      nino,
    });

    const hydratedBusinesses = [...hydration.businesses];

    const existingTypes = new Set<CanonicalSourceType>(
      hydratedBusinesses.map((x) => x.canonical_source_type),
    );

    const requiredTypes: CanonicalSourceType[] = [];

    if (body.includeSelfEmployment) requiredTypes.push("self_employment");
    if (body.includeUkProperty !== false) requiredTypes.push("uk_property");
    if (body.includeForeignProperty !== false) requiredTypes.push("foreign_property");

    const sandboxFallbacks: Array<{
      canonical_source_type: CanonicalSourceType;
      hmrc_business_id: string;
      raw: any;
    }> = [];

    for (const type of requiredTypes) {
      if (existingTypes.has(type)) continue;

      if (type === "uk_property" || type === "foreign_property") {
        const hmrcBusinessId = deterministicSandboxBusinessId(type);

        const fallback = {
          canonical_source_type: type,
          hmrc_business_id: hmrcBusinessId,
          raw: {
            businessId: hmrcBusinessId,
            typeOfBusiness: type === "uk_property" ? "uk-property" : "foreign-property",
            sandboxFallback: true,
            reason:
              "HMRC sandbox Business Details API returned 404 despite RULE_PROPERTY_BUSINESS_ADDED confirmation.",
          },
        };

        hydratedBusinesses.push(fallback);
        sandboxFallbacks.push(fallback);
      }
    }

    const persisted = await persistHmrcBusinessMappings({
      clientId: body.clientId,
      nino,
      accessToken,
      businesses: hydratedBusinesses,
    });

    const provisioning = await runProvisioning(body.clientId);

    return NextResponse.json({
      success: true,
      clientId: body.clientId,
      taxYear,
      nino,
      createResults,
      hydrationAttempts: hydration.attempts,
      sandboxFallbacks,
      hydratedBusinesses,
      persistedIncomeSources: persisted,
      provisioning,
      next: [
        "Refresh quarter workspace.",
        "Verify UK property source now maps to XPIS12345678901.",
        "Verify foreign property source now maps to XFIS12345678901.",
        "Retry cumulative property submission.",
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unexpected prepare-client failure",
        detail: error,
      },
      { status: 500 },
    );
  }
}
