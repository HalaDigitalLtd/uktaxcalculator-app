import { v4 as uuidv4 } from "uuid";

const HMRC_BASE_URL =
  process.env.HMRC_ENVIRONMENT === "production"
    ? "https://api.service.hmrc.gov.uk"
    : "https://test-api.service.hmrc.gov.uk";

export interface HMRCRequestOptions {
  accessToken: string;
  endpoint: string;
  method?: string;
  body?: any;
  fraudHeaders?: Record<string, string>;
  testScenario?: string | null;
  acceptHeader?: string;
}

export interface HMRCResponse {
  success: boolean;
  status: number;
  correlationId: string | null;
  data: any;
}

export async function hmrcRequest({
  accessToken,
  endpoint,
  method = "GET",
  body,
  fraudHeaders = {},
  testScenario = null,
  acceptHeader = "application/vnd.hmrc.5.0+json",
}: HMRCRequestOptions): Promise<HMRCResponse> {
  const correlationId = uuidv4();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: acceptHeader,
    "Content-Type": "application/json",
    "X-CorrelationId": correlationId,
    ...fraudHeaders,
  };

  if (testScenario && process.env.HMRC_ENVIRONMENT !== "production") {
    headers["Gov-Test-Scenario"] = testScenario;
  }

  const response = await fetch(`${HMRC_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();

  let data: any = null;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = {
      rawResponse: responseText,
      parseError: "HMRC returned non-JSON response",
    };
  }

  return {
    success: response.ok,
    status: response.status,
    correlationId:
      response.headers.get("X-CorrelationId") ||
      response.headers.get("x-correlationid") ||
      correlationId,
    data,
  };
}