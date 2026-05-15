import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isBillingActive(status: string | null | undefined) {
  const normalised = String(status || "").toLowerCase();
  return normalised === "active" || normalised === "trialing";
}

async function resolveFirmForUser(userId: string, requestedFirmId: string | null) {
  let query = supabaseAdmin
    .from("firm_users")
    .select("firm_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (requestedFirmId) {
    query = query.eq("firm_id", requestedFirmId);
  }

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
      });
    }

    const { data: subscription, error } = await supabaseAdmin
      .from("firm_subscriptions")
      .select(
        "firm_id, status, billing_status, access_status, access_lock_reason, current_period_end, trial_end"
      )
      .eq("firm_id", firmUser.firm_id)
      .maybeSingle();

    if (error) throw error;

    const billingStatus = String(
      subscription?.billing_status || subscription?.status || "none"
    );

    const allowed = isBillingActive(billingStatus);

    if (!allowed && subscription?.firm_id) {
      await supabaseAdmin
        .from("firm_subscriptions")
        .update({
          access_status: "restricted",
          access_locked_at: new Date().toISOString(),
          access_lock_reason: `billing_status_${billingStatus}`,
          updated_at: new Date().toISOString(),
        })
        .eq("firm_id", firmUser.firm_id);
    }

    return NextResponse.json({
      success: true,
      allowed,
      reason: allowed ? null : `billing_status_${billingStatus}`,
      firmId: firmUser.firm_id,
      billingStatus,
      role: firmUser.role,
      currentPeriodEnd: subscription?.current_period_end || null,
      trialEnd: subscription?.trial_end || null,
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
