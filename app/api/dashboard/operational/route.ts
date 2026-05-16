import { NextRequest, NextResponse } from "next/server";
import { getOperationalDashboard } from "../../../../lib/operationalDashboard";
import {
  getAuthenticatedUserFromRequest,
  getUserFirmIds,
  isHalaAdmin,
} from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";

function getFirmIdFromRequest(request: NextRequest) {
  const url = new URL(request.url);
  return url.searchParams.get("firmId");
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const firmId = getFirmIdFromRequest(request);

    if (!firmId) {
      return NextResponse.json(
        {
          success: false,
          error: "firm_id_required",
          message: "Firm ID is required for operational dashboard.",
        },
        { status: 400 }
      );
    }

    const admin = await isHalaAdmin(user.email);
    const firmIds = await getUserFirmIds(user.id);

    if (!admin && !firmIds.includes(firmId)) {
      return NextResponse.json(
        {
          success: false,
          error: "firm_access_denied",
          message: "You do not have access to this firm dashboard.",
        },
        { status: 403 }
      );
    }

    const dashboard = await getOperationalDashboard(firmId);

    return NextResponse.json(dashboard, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "operational_dashboard_failed",
        message: error?.message || "Unable to load operational dashboard.",
      },
      { status: 500 }
    );
  }
}
