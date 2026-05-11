export type HmrcSourceType =
  | "self_employment"
  | "uk_property"
  | "foreign_property";

export type HmrcSubmissionStrategy =
  | "self_employment_period_summary"
  | "self_employment_cumulative"
  | "uk_property_period_summary"
  | "uk_property_cumulative"
  | "foreign_property_period_summary"
  | "foreign_property_cumulative";

export type HmrcSubmissionStrategyResult = {
  supported: boolean;
  strategy: HmrcSubmissionStrategy | null;
  endpoint: string | null;
  method: "POST" | "PUT" | null;
  acceptHeader: string;
  requiresTaxYearInEndpoint: boolean;
  requiresPropertyId: boolean;
  responseSubmissionIdField: "submissionId" | "periodId" | null;
  unsupportedCode: string | null;
  unsupportedReason: string | null;
  taxYear: string;
  taxYearStart: number | null;
  sourceType: HmrcSourceType;
};

export function taxYearCode(label: string) {
  const clean = String(label || "").trim();

  const fullMatch = clean.match(/^(20\d{2})-(\d{2})$/);
  if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]}`;

  const shortMatch = clean.match(/^(\d{2})-(\d{2})$/);
  if (shortMatch) return `20${shortMatch[1]}-${shortMatch[2]}`;

  return clean;
}

export function taxYearStartYear(label: string): number | null {
  const code = taxYearCode(label);
  const match = code.match(/^(20\d{2})-\d{2}$/);
  return match ? Number(match[1]) : null;
}

export function resolveHmrcQuarterSubmissionStrategy(params: {
  sourceType: HmrcSourceType;
  nino: string;
  businessId: string;
  taxYearLabel: string;
  propertyId?: string | null;
  environment?: "sandbox" | "production";
}): HmrcSubmissionStrategyResult {
  const { sourceType, nino, businessId, propertyId } = params;
  const taxYear = taxYearCode(params.taxYearLabel);
  const startYear = taxYearStartYear(taxYear);
  const environment = params.environment || "sandbox";

  const base: Omit<
    HmrcSubmissionStrategyResult,
    | "supported"
    | "strategy"
    | "endpoint"
    | "method"
    | "requiresPropertyId"
    | "responseSubmissionIdField"
    | "unsupportedCode"
    | "unsupportedReason"
  > = {
    acceptHeader:
      sourceType === "self_employment"
        ? "application/vnd.hmrc.5.0+json"
        : "application/vnd.hmrc.6.0+json",
    requiresTaxYearInEndpoint: sourceType !== "self_employment",
    taxYear,
    taxYearStart: startYear,
    sourceType,
  };

  const unsupported = (
    code: string,
    reason: string,
    requiresPropertyId = false
  ): HmrcSubmissionStrategyResult => ({
    ...base,
    supported: false,
    strategy: null,
    endpoint: null,
    method: null,
    requiresPropertyId,
    responseSubmissionIdField: null,
    unsupportedCode: code,
    unsupportedReason: reason,
  });

  if (!nino || !businessId || !taxYear || !startYear) {
    return unsupported(
      "HMRC_STRATEGY_INPUT_MISSING",
      "Missing NINO, business ID, or valid tax year. Strategy could not be resolved safely."
    );
  }

  if (sourceType === "self_employment") {
    if (startYear <= 2024) {
      return {
        ...base,
        supported: true,
        strategy: "self_employment_period_summary",
        endpoint: `/individuals/business/self-employment/${nino}/${businessId}/period`,
        method: "POST",
        requiresPropertyId: false,
        responseSubmissionIdField: "periodId",
        unsupportedCode: null,
        unsupportedReason: null,
      };
    }

    return {
      ...base,
      supported: true,
      strategy: "self_employment_cumulative",
      endpoint: `/individuals/business/self-employment/${nino}/${businessId}/cumulative/${taxYear}`,
      method: "PUT",
      requiresPropertyId: false,
      responseSubmissionIdField: null,
      unsupportedCode: null,
      unsupportedReason: null,
    };
  }

  if (sourceType === "uk_property") {
    if (environment === "sandbox" && startYear < 2021) {
      return unsupported(
        "UNSUPPORTED_PROPERTY_TAX_YEAR",
        "HMRC Property Business sandbox minimum tax year for property period/annual APIs is 2021-22."
      );
    }

    if (startYear <= 2024) {
      return {
        ...base,
        supported: true,
        strategy: "uk_property_period_summary",
        endpoint: `/individuals/business/property/uk/${nino}/${businessId}/period/${taxYear}`,
        method: "POST",
        requiresPropertyId: false,
        responseSubmissionIdField: "submissionId",
        unsupportedCode: null,
        unsupportedReason: null,
      };
    }

    return {
      ...base,
      supported: true,
      strategy: "uk_property_cumulative",
      endpoint: `/individuals/business/property/uk/${nino}/${businessId}/cumulative/${taxYear}`,
      method: "PUT",
      requiresPropertyId: false,
      responseSubmissionIdField: null,
      unsupportedCode: null,
      unsupportedReason: null,
    };
  }

  if (sourceType === "foreign_property") {
    if (environment === "sandbox" && startYear < 2021) {
      return unsupported(
        "UNSUPPORTED_PROPERTY_TAX_YEAR",
        "HMRC Foreign Property sandbox minimum tax year is 2021-22 and maximum old period-summary support is 2024-25."
      );
    }

    if (startYear <= 2024) {
      return {
        ...base,
        supported: true,
        strategy: "foreign_property_period_summary",
        endpoint: `/individuals/business/property/foreign/${nino}/${businessId}/period/${taxYear}`,
        method: "POST",
        requiresPropertyId: false,
        responseSubmissionIdField: "submissionId",
        unsupportedCode: null,
        unsupportedReason: null,
      };
    }

    if (startYear >= 2026 && !propertyId) {
      return unsupported(
        "FOREIGN_PROPERTY_ID_REQUIRED",
        "HMRC foreign property cumulative flow supports propertyId from 2026-27 onwards. Store/retrieve propertyId before submission.",
        true
      );
    }

    const propertyIdQuery =
      startYear >= 2026 && propertyId
        ? `?propertyId=${encodeURIComponent(propertyId)}`
        : "";

    return {
      ...base,
      supported: true,
      strategy: "foreign_property_cumulative",
      endpoint: `/individuals/business/property/foreign/${nino}/${businessId}/cumulative/${taxYear}${propertyIdQuery}`,
      method: "PUT",
      requiresPropertyId: startYear >= 2026,
      responseSubmissionIdField: null,
      unsupportedCode: null,
      unsupportedReason: null,
    };
  }

  return unsupported(
    "UNSUPPORTED_SOURCE_TYPE",
    "Unsupported source type for quarterly HMRC submission."
  );
}