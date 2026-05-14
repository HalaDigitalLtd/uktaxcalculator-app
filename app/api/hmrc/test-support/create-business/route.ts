import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getValidHmrcToken } from "../../../../../lib/hmrc/getValidHmrcToken";
import {
  cleanNino,
  createTestBusiness,
  hydrateHmrcBusinessIds,
  persistHmrcBusinessMappings,
  type TestBusinessType,
} from "../../../../../lib/hmrc/testSupportBusinesses";

export const dynamic = "force-dynamic";

type Body = {
  clientId: string;
  nino: string;
  typeOfBusiness: TestBusinessType;
  taxYear?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.clientId) return bad("clientId is required");
    if (!body.nino) return bad("nino is required");
    if (!body.typeOfBusiness) return bad("typeOfBusiness is required");

    const clientId = body.clientId;
    const nino = cleanNino(body.nino);
    const taxYear = body.taxYear || "2026-27";

    const token = await getValidHmrcToken(clientId);

    const accessToken = token.accessToken;

    if (!accessToken) {
      return bad("No valid HMRC access token found for this client", 401);
    }

    const createResult = await createTestBusiness({
      accessToken,
      nino,
      typeOfBusiness: body.typeOfBusiness,
      taxYear,
    });

    if (!createResult.created && !createResult.alreadyExisted) {
      return NextResponse.json(
        {
          success: false,
          stage: "create-test-business",
          createResult,
        },
        { status: 400 },
      );
    }

    const hydration = await hydrateHmrcBusinessIds({
      accessToken,
      nino,
    });

    const persisted = await persistHmrcBusinessMappings({
      clientId,
      nino,
      accessToken,
      businesses: hydration.businesses,
    });

    return NextResponse.json({
      success: true,
      clientId,
      nino,
      taxYear,
      requestedBusinessType: body.typeOfBusiness,
      createResult,
      hydratedBusinesses: hydration.businesses,
      persistedIncomeSources: persisted,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unexpected create-business failure",
        detail: error,
      },
      { status: 500 },
    );
  }
}