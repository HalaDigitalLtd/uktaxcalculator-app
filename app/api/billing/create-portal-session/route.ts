import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
  });
}

function originFromRequest(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    "http://localhost:3000"
  );
}

async function getUserFirmRole(userId: string, firmId: string) {
  const { data, error } = await supabaseAdmin
    .from("firm_users")
    .select("role, status")
    .eq("user_id", userId)
    .eq("firm_id", firmId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const firmId = body?.firmId;

    if (!firmId) {
      return NextResponse.json(
        { success: false, error: "firmId is required" },
        { status: 400 }
      );
    }

    const role = await getUserFirmRole(user.id, firmId);

    if (!role || !["admin", "partner", "hala_super_admin"].includes(role.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only firm admins or partners can manage billing",
        },
        { status: 403 }
      );
    }

    const { data: subscription, error } = await supabaseAdmin
      .from("firm_subscriptions")
      .select("stripe_customer_id")
      .eq("firm_id", firmId)
      .maybeSingle();

    if (error) throw error;

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: "No Stripe customer found for this firm",
        },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const origin = originFromRequest(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/dashboard/settings?billing=returned`,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create billing portal session",
      },
      { status: 500 }
    );
  }
}
