import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENV_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  practice: process.env.STRIPE_PRICE_PRACTICE,
  scale: process.env.STRIPE_PRICE_SCALE,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

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

async function getFirmMembership(userId: string, requestedFirmId?: string | null) {
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

async function getFirmBillingEmail(firmId: string, userEmail?: string | null) {
  const { data } = await supabaseAdmin
    .from("firms")
    .select("name, email")
    .eq("id", firmId)
    .maybeSingle();

  return {
    firmName: data?.name || "Hala Digital Firm",
    email: data?.email || userEmail || undefined,
  };
}

async function getPlan(planSlug: string) {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .eq("slug", planSlug)
    .maybeSingle();

  if (error) throw error;

  const envPriceId = ENV_PRICE_IDS[planSlug];

  if (data?.stripe_price_id || envPriceId) {
    return {
      slug: planSlug,
      planId: data?.id || null,
      name: data?.name || planSlug,
      stripePriceId: data?.stripe_price_id || envPriceId,
    };
  }

  throw new Error(`Stripe price ID missing for plan: ${planSlug}`);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const planSlug = String(body?.planSlug || "practice").toLowerCase();
    const requestedFirmId = body?.firmId ? String(body.firmId) : null;

    const membership = await getFirmMembership(user.id, requestedFirmId);

    if (!membership?.firm_id) {
      return NextResponse.json(
        { success: false, error: "No active firm membership found" },
        { status: 403 }
      );
    }

    if (!["admin", "partner", "hala_super_admin"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: "Only firm admins or partners can start billing" },
        { status: 403 }
      );
    }

    const firmId = membership.firm_id;
    const plan = await getPlan(planSlug);
    const stripe = getStripe();
    const origin = originFromRequest(req);
    const firmBilling = await getFirmBillingEmail(firmId, (user as any)?.email);

    const { data: existingSub, error: subError } = await supabaseAdmin
      .from("firm_subscriptions")
      .select("stripe_customer_id")
      .eq("firm_id", firmId)
      .maybeSingle();

    if (subError) throw subError;

    let customerId = existingSub?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: firmBilling.email,
        name: firmBilling.firmName,
        metadata: {
          firm_id: firmId,
          created_by_user_id: user.id,
        },
      });

      customerId = customer.id;
    }

    await supabaseAdmin.from("firm_subscriptions").upsert(
      {
        firm_id: firmId,
        plan_id: plan.planId,
        stripe_customer_id: customerId,
        stripe_price_id: plan.stripePriceId,
        status: "pending",
        billing_status: "pending",
        access_status: "restricted",
        access_lock_reason: "checkout_pending",
        onboarding_status: "billing_started",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "firm_id" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/settings/billing?checkout=cancelled`,
      subscription_data: {
        metadata: {
          firm_id: firmId,
          plan_slug: plan.slug,
          created_by_user_id: user.id,
        },
      },
      metadata: {
        firm_id: firmId,
        plan_slug: plan.slug,
        created_by_user_id: user.id,
      },
      allow_promotion_codes: true,
    });

    await supabaseAdmin.from("billing_events").insert({
      firm_id: firmId,
      event_type: "checkout_session_created",
      stripe_customer_id: customerId,
      status: "pending",
      payload: {
        checkoutSessionId: session.id,
        planSlug: plan.slug,
        stripePriceId: plan.stripePriceId,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}
