import { NextRequest, NextResponse } from "next/server";
import { getValidHmrcToken } from "../../../../../lib/hmrc/getValidHmrcToken";
import {
  getAuthenticatedUserFromRequest,
  assertClientAccess,
} from "../../../../../lib/hmrc/tenantSecurity";
import {
  cleanNino,
  createSandboxTestBusiness,
  type TestBusinessType,
} from "../../../../../lib/hmrc/testSupportBusinesses";

export const dynamic = "force-dynamic";

const DEFAULT_BUSINESSES: TestBusinessType[] = [
  "uk-property",
  "foreign-property",
];

export async function POST(req: NextRequest) {
  try {
    if (process.env.HMRC_ENVIRONMENT === "production") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sandbox client preparation is disabled in production.",
        },
        { status: 403 }
      );
    }

    const user = await getAuthenticatedUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const clientId = body.clientId || body.client_id;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId required" },
        { status: 400 }
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

    const requestedBusinesses =
      Array.isArray(body.businesses) && body.businesses.length
        ? (body.businesses as TestBusinessType[])
        : DEFAULT_BUSINESSES;

    const results = [];

    for (const typeOfBusiness of requestedBusinesses) {
      const result = await createSandboxTestBusiness({
        accessToken,
        firmId: client.firm_id,
        clientId: client.id,
        nino,
        typeOfBusiness,
        overridePayload: body.hmrcPayloadByType?.[typeOfBusiness] || {},
      });

      results.push(result);
    }

    const allSuccess = results.every((r) => r.success);
    const anySuccess = results.some((r) => r.success);

    return NextResponse.json(
      {
        success: allSuccess,
        partial_success: anySuccess && !allSuccess,
        message: allSuccess
          ? "HMRC sandbox client prepared successfully."
          : anySuccess
            ? "HMRC sandbox client partially prepared."
            : "HMRC sandbox client preparation failed.",
        firmId: client.firm_id,
        clientId: client.id,
        nino,
        preparedBusinesses: results,
        nextStep:
          "Run HMRC obligations sync using STATEFUL scenario, then provision quarters and submit.",
      },
      { status: allSuccess || anySuccess ? 200 : 502 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}