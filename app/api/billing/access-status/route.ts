import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";
import { getFirmBillingAccess } from "../../../../lib/billing/accessControl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveFirmForUser(userId: string, requestedFirmId: string | null) {
  let query = supabaseAdmin
    .from("firm_users")
    .select("firm_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (requestedFirmId) query = query.eq("firm_id", requestedFirmId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(req: NextRequest) {
  try {
    let user: any = null;

    try {
      user = await getAuthenticatedUserFromRequest(req);
    } catch {
      return NextResponse.json({
        success: true,
        allowed: false,
        reason: "unauthenticated",
        firmId: null,
        billingStatus: "none",
        accessStatus: "restricted",
        planSlug: "starter",
      });
    }

    const requestedFirmId = req.nextUrl.searchParams.get("firmId");
    const firmUser = await resolveFirmForUser(user.id, requestedFirmId);

    if (!firmUser?.firm_id) {
      return NextResponse.json({
        success: true,
        allowed: false,
        reason: "no_active_firm",
        firmId: null,
        billingStatus: "none",
        accessStatus: "restricted",
        planSlug: "starter",
      });
    }

    const access = await getFirmBillingAccess(firmUser.firm_id);

    return NextResponse.json({
      success: true,
      allowed: access.allowed,
      reason: access.reason,
      firmId: access.firmId,
      billingStatus: access.billingStatus,
      accessStatus: access.accessStatus,
      planSlug: access.planSlug,
      gracePeriodEndsAt: access.gracePeriodEndsAt,
      role: firmUser.role,
      limits: access.limits,
      usage: access.usage,
      features: access.features,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        allowed: false,
        reason: error?.message || "billing_access_check_failed",
      },
      { status: 500 }
    );
  }
}
