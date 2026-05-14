import { supabaseAdmin } from "../supabaseAdmin";

export type TestBusinessType =
  | "self-employment"
  | "uk-property"
  | "foreign-property"
  | "property-unspecified";

export type CanonicalSourceType =
  | "self_employment"
  | "uk_property"
  | "foreign_property"
  | "property_unspecified";

type BusinessDetailsScenario =
  | "STATEFUL"
  | "PROPERTY"
  | "FOREIGN_PROPERTY"
  | "BUSINESS_AND_PROPERTY"
  | "UNSPECIFIED"
  | "DYNAMIC";

const HMRC_BASE_URL =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

export function cleanNino(nino: string) {
  return String(nino || "").replace(/\s+/g, "").toUpperCase();
}

export function canonicalSourceType(type: string): CanonicalSourceType {
  if (type === "self-employment" || type === "self_employment") {
    return "self_employment";
  }

  if (
    type === "uk-property" ||
    type === "uk_property" ||
    type === "ukProperty"
  ) {
    return "uk_property";
  }

  if (
    type === "foreign-property" ||
    type === "foreign_property" ||
    type === "foreignProperty"
  ) {
    return "foreign_property";
  }

  return "property_unspecified";
}

export function hmrcTestBusinessType(type: CanonicalSourceType): TestBusinessType {
  if (type === "self_employment") return "self-employment";
  if (type === "uk_property") return "uk-property";
  if (type === "foreign_property") return "foreign-property";
  return "property-unspecified";
}

function nextTaxYear(taxYear: string) {
  const [start] = taxYear.split("-").map(Number);
  return `${start + 1}-${String((start + 2) % 100).padStart(2, "0")}`;
}

function defaultLatency(taxYear: string) {
  const startYear = Number(taxYear.slice(0, 4));

  return {
    latencyEndDate: `${startYear + 1}-04-05`,
    taxYear1: taxYear,
    latencyIndicator1: "Q",
    taxYear2: nextTaxYear(taxYear),
    latencyIndicator2: "Q",
  };
}

export function defaultBusinessPayload(
  typeOfBusiness: TestBusinessType,
  taxYear = "2026-27",
) {
  const startYear = Number(taxYear.slice(0, 4));
  const isProperty = typeOfBusiness.includes("property");

  return {
    typeOfBusiness,

    ...(isProperty
      ? {}
      : {
          tradingName: "Hala Test Trade",
          businessAddressLineOne: "1 Test Street",
          businessAddressLineTwo: "Test Area",
          businessAddressCountryCode: "GB",
          businessAddressPostcode: "AA1 1AA",
        }),

    firstAccountingPeriodStartDate: `${startYear}-04-06`,
    firstAccountingPeriodEndDate: `${startYear + 1}-04-05`,

    latencyDetails: defaultLatency(taxYear),

    quarterlyTypeChoice: {
      taxYearOfChoice: taxYear,
      quarterlyPeriodType: "standard",
    },
  };
}

async function hmrcJsonRequest<T>({
  accessToken,
  method,
  path,
  body,
  scenario,
}: {
  accessToken: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  scenario?: BusinessDetailsScenario;
}): Promise<{
  ok: boolean;
  status: number;
  correlationId: string | null;
  data: T | null;
  error: any | null;
}> {
  const res = await fetch(`${HMRC_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(scenario ? { "Gov-Test-Scenario": scenario } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: any = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { rawResponse: text };
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    correlationId:
      res.headers.get("x-correlationid") || res.headers.get("x-correlation-id"),
    data: res.ok ? parsed : null,
    error: res.ok ? null : parsed,
  };
}

export async function createTestBusiness({
  accessToken,
  nino,
  typeOfBusiness,
  taxYear,
}: {
  accessToken: string;
  nino: string;
  typeOfBusiness: TestBusinessType;
  taxYear: string;
}) {
  const payload = defaultBusinessPayload(typeOfBusiness, taxYear);

  const result = await hmrcJsonRequest<{ businessId?: string }>({
    accessToken,
    method: "POST",
    path: `/individuals/self-assessment-test-support/business/${cleanNino(nino)}`,
    body: payload,
  });

  const errorCode = result.error?.code;

  if (result.ok && result.data?.businessId) {
    return {
      created: true,
      alreadyExisted: false,
      businessId: result.data.businessId,
      status: result.status,
      correlationId: result.correlationId,
      payload,
      response: result.data,
      error: null,
    };
  }

  if (
    errorCode === "RULE_PROPERTY_BUSINESS_ADDED" ||
    errorCode === "RULE_INCOME_SOURCE_ALREADY_EXISTS" ||
    errorCode === "RULE_BUSINESS_ALREADY_EXISTS"
  ) {
    return {
      created: false,
      alreadyExisted: true,
      businessId: null,
      status: result.status,
      correlationId: result.correlationId,
      payload,
      response: null,
      error: result.error,
    };
  }

  return {
    created: false,
    alreadyExisted: false,
    businessId: null,
    status: result.status,
    correlationId: result.correlationId,
    payload,
    response: result.data,
    error: result.error,
  };
}

export async function listAllBusinesses({
  accessToken,
  nino,
  scenario,
}: {
  accessToken: string;
  nino: string;
  scenario?: BusinessDetailsScenario;
}) {
  return hmrcJsonRequest<any>({
    accessToken,
    method: "GET",
    path: `/individuals/business/details/${cleanNino(nino)}/list`,
    scenario,
  });
}

function normaliseArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getBusinessId(row: any) {
  return (
    row?.businessId ||
    row?.incomeSourceId ||
    row?.incomeSourceIdentifier ||
    row?.incomeSourceID ||
    row?.id ||
    null
  );
}

function extractBusinesses(raw: any) {
  const rows: Array<{
    canonical_source_type: CanonicalSourceType;
    hmrc_business_id: string;
    raw: any;
  }> = [];

  const push = (items: any, fallbackType?: CanonicalSourceType) => {
    for (const item of normaliseArray(items)) {
      const id = getBusinessId(item);
      const type = canonicalSourceType(item?.typeOfBusiness || fallbackType || "");

      if (id && type !== "property_unspecified") {
        rows.push({
          canonical_source_type: type,
          hmrc_business_id: String(id),
          raw: item,
        });
      }
    }
  };

  push(raw?.listOfBusinesses);

  const incomeSources =
    raw?.incomeSources ||
    raw?.businessData ||
    raw?.businesses ||
    raw?.propertyBusiness ||
    raw ||
    {};

  push(incomeSources.selfEmployments, "self_employment");
  push(incomeSources.selfEmployment, "self_employment");
  push(incomeSources.selfEmploymentBusinesses, "self_employment");

  push(incomeSources.property, "uk_property");
  push(incomeSources.properties, "uk_property");
  push(incomeSources.propertyBusinesses, "uk_property");
  push(incomeSources.ukProperty, "uk_property");
  push(incomeSources.ukPropertyBusinesses, "uk_property");
  push(incomeSources.ukProperties, "uk_property");

  push(incomeSources.foreignProperty, "foreign_property");
  push(incomeSources.foreignPropertyBusinesses, "foreign_property");
  push(incomeSources.foreignProperties, "foreign_property");

  return rows;
}

export async function hydrateHmrcBusinessIds({
  accessToken,
  nino,
}: {
  accessToken: string;
  nino: string;
}) {
  const attempts = [
    await listAllBusinesses({ accessToken, nino, scenario: "STATEFUL" }),
    await listAllBusinesses({ accessToken, nino, scenario: "BUSINESS_AND_PROPERTY" }),
    await listAllBusinesses({ accessToken, nino, scenario: "PROPERTY" }),
    await listAllBusinesses({ accessToken, nino, scenario: "FOREIGN_PROPERTY" }),
    await listAllBusinesses({ accessToken, nino }),
  ];

  const merged = new Map<
    string,
    {
      canonical_source_type: CanonicalSourceType;
      hmrc_business_id: string;
      raw: any;
    }
  >();

  for (const attempt of attempts) {
    if (!attempt.ok || !attempt.data) continue;

    for (const row of extractBusinesses(attempt.data)) {
      merged.set(`${row.canonical_source_type}:${row.hmrc_business_id}`, row);
    }
  }

  return {
    attempts,
    businesses: Array.from(merged.values()),
  };
}

export async function persistHmrcBusinessMappings({
  clientId,
  nino,
  accessToken,
  businesses,
}: {
  clientId: string;
  nino: string;
  accessToken: string;
  businesses: Array<{
    canonical_source_type: CanonicalSourceType;
    hmrc_business_id: string;
    raw: any;
  }>;
}) {
  const now = new Date().toISOString();
  const persisted: any[] = [];

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, firm_id")
    .eq("id", clientId)
    .single();

  if (clientError) throw clientError;

  for (const business of businesses) {
    const { canonical_source_type, hmrc_business_id, raw } = business;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("hmrc_income_sources")
      .select("id")
      .eq("client_id", clientId)
      .eq("canonical_source_type", canonical_source_type)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      firm_id: client.firm_id,
      client_id: clientId,
      canonical_source_type,
      type_of_business: hmrcTestBusinessType(canonical_source_type),
      hmrc_business_id,
      display_name:
        canonical_source_type === "uk_property"
          ? "UK Property"
          : canonical_source_type === "foreign_property"
            ? "Foreign Property"
            : raw?.tradingName || "Self Employment",
      source_name:
        canonical_source_type === "uk_property"
          ? "UK Property"
          : canonical_source_type === "foreign_property"
            ? "Foreign Property"
            : raw?.tradingName || "Self Employment",
      accounting_type: raw?.accountingType || raw?.accountingMethod || null,
      trading_name: raw?.tradingName || null,
      active: true,
      last_seen_at: now,
      last_hmrc_sync_at: now,
      environment: "sandbox",
      sync_source: "hmrc_test_support_prepare_client",
      source_status: "active",
      hmrc_evidence_status: "hmrc_matched",
      raw_source: {
        nino: cleanNino(nino),
        hmrc_business_id,
        canonical_source_type,
        raw,
      },
      metadata: {
        prepared_by: "test-support/prepare-client",
        prepared_at: now,
        access_token_available: Boolean(accessToken),
      },
    };

    const query = existing?.id
      ? supabaseAdmin
          .from("hmrc_income_sources")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()
      : supabaseAdmin
          .from("hmrc_income_sources")
          .insert({
            ...payload,
            first_seen_at: now,
            first_seen_from: "hmrc_test_support_prepare_client",
          })
          .select()
          .single();

    const { data, error } = await query;
    if (error) throw error;

    persisted.push(data);

    const { error: obligationsError } = await supabaseAdmin
      .from("hmrc_obligations")
      .update({
        income_source_id: data.id,
        hmrc_business_id,
      })
      .eq("client_id", clientId)
      .eq("canonical_source_type", canonical_source_type);

    if (obligationsError) throw obligationsError;

    const { error: quarterSourcesError } = await supabaseAdmin
      .from("quarter_income_sources")
      .update({
        income_source_id: data.id,
        hmrc_business_id,
        hmrc_source: "hmrc_test_support_prepare_client",
        source_evidence_status: "hmrc_matched",
      })
      .eq("client_id", clientId)
      .eq("canonical_source_type", canonical_source_type);

    if (quarterSourcesError) throw quarterSourcesError;
  }

  return persisted;
}