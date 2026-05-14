type HmrcRequestParams = {
  accessToken: string;
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  fraudHeaders?: Record<string, string>;
  acceptHeader?: string;
  testScenario?: string | null;
};

function getHmrcBaseUrl() {
  return process.env.HMRC_ENVIRONMENT === "production"
    ? "https://api.service.hmrc.gov.uk"
    : "https://test-api.service.hmrc.gov.uk";
}

function safeJsonParse(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse: text,
      parseError: "Non-JSON HMRC response",
    };
  }
}

function resolveSandboxGovTestScenario(params: {
  endpoint: string;
  method: string;
  explicitScenario?: string | null;
}) {
  if (process.env.HMRC_ENVIRONMENT === "production") return null;

  const explicit = String(params.explicitScenario || "").trim().toUpperCase();

  if (explicit && explicit !== "CUMULATIVE") {
    return explicit;
  }

  const endpoint = params.endpoint.toLowerCase();
  const method = params.method.toUpperCase();

  const isPropertyCumulativePut =
    method === "PUT" &&
    endpoint.includes("/individuals/business/property/") &&
    endpoint.includes("/cumulative/");

  if (isPropertyCumulativePut) {
    return "STATEFUL";
  }

  return null;
}

export async function hmrcRequest({
  accessToken,
  endpoint,
  method = "GET",
  body,
  fraudHeaders = {},
  acceptHeader,
  testScenario = null,
}: HmrcRequestParams) {
  const url = `${getHmrcBaseUrl()}${endpoint}`;

  const resolvedGovTestScenario = resolveSandboxGovTestScenario({
    endpoint,
    method,
    explicitScenario: testScenario,
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: acceptHeader || "application/vnd.hmrc.5.0+json",
    ...fraudHeaders,
  };

  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (resolvedGovTestScenario) {
    headers["Gov-Test-Scenario"] = resolvedGovTestScenario;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const responseText = await response.text();
  const data = safeJsonParse(responseText);

  const correlationId =
    response.headers.get("correlationId") ||
    response.headers.get("x-correlation-id") ||
    response.headers.get("X-Correlation-ID") ||
    null;

  return {
    success: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
    correlationId,
    endpoint,
    method,
    govTestScenario: resolvedGovTestScenario,
  };
}