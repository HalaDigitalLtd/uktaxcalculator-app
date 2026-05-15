import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";

type Body = {
  planCode?: string;
  firmId?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getBaseUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL;

  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  return req.nextUrl.origin;
}

function roleCanManageBilling(role: string | null | undefined) {
  return ["owner", "admin", "partner", "hala_super_admin"].includes(
    String(role || "").toLowerCase(),
  );
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return bad("STRIPE_SECRET_KEY is not configured.", 500);
    }

    const stripe = new Stripe(stripeSecretKey);

    const user = await getAuthenticatedUserFromRequest(req);

    let body: Body = {};

    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const planCode = body.planCode || "beta_founder";

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("code", planCode)
      .eq("active", true)
      .maybeSingle();

    if (planError) {
      return bad(planError.message, 500);
    }

    if (!plan) {
      return bad("Subscription plan not found or inactive.", 404);
    }

    let firmId = body.firmId || "";

    if (!firmId) {
      const { data: firmMemberships, error: membershipLookupError } =
        await supabaseAdmin
          .from("firm_users")
          .select("firm_id, role, status, is_active")
          .eq("user_id", user.id)
          .eq("status", "active")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1);

      if (membershipLookupError) {
        return bad(membershipLookupError.message, 500);
      }

      firmId = String(firmMemberships?.[0]?.firm_id || "");
    }

    if (!firmId) {
      return bad("No active firm found for this user.", 403);
    }

    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from("firm_users")
      .select("firm_id, user_id, role, status, is_active")
      .eq("firm_id", firmId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("is_active", true)
      .limit(1);

    if (membershipError) {
      return bad(membershipError.message, 500);
    }

    const membership = membershipRows?.[0];

    if (!membership || !roleCanManageBilling(membership.role)) {
      return bad("You do not have permission to manage billing for this firm.", 403);
    }

    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .select("*")
      .eq("id", firmId)
      .maybeSingle();

    if (firmError) {
      return bad(firmError.message, 500);
    }

    if (!firm) {
      return bad("Firm not found.", 404);
    }

    const { data: existingSubscription, error: existingSubError } =
      await supabaseAdmin
        .from("firm_subscriptions")
        .select("*")
        .eq("firm_id", firmId)
        .maybeSingle();

    if (existingSubError) {
      return bad(existingSubError.message, 500);
    }

    let stripeCustomerId = existingSubscription?.stripe_customer_id || null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: firm.name || firm.firm_name || firm.practice_name || undefined,
        metadata: {
          firmId,
          userId: user.id,
          source: "hala_digital_saas_checkout",
        },
      });

      stripeCustomerId = customer.id;
    }

    const baseUrl = getBaseUrl(req);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: firmId,
      success_url: `${baseUrl}/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/hala?billing=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      line_items: [
        plan.stripe_price_id
          ? {
              price: plan.stripe_price_id,
              quantity: 1,
            }
          : {
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: Math.round(Number(plan.monthly_price_gbp || 0) * 100),
                recurring: {
                  interval: "month",
                },
                product_data: {
                  name: plan.name,
                  description: plan.description || undefined,
                  metadata: {
                    planCode: plan.code,
                    planId: plan.id,
                  },
                },
              },
            },
      ],
      subscription_data: {
        metadata: {
          firmId,
          planId: plan.id,
          planCode: plan.code,
          userId: user.id,
        },
      },
      metadata: {
        firmId,
        planId: plan.id,
        planCode: plan.code,
        userId: user.id,
      },
    });

    const now = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("firm_subscriptions")
      .upsert(
        {
          firm_id: firmId,
          plan_id: plan.id,
          status: "checkout_pending",
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: null,
          cancel_at_period_end: false,
          updated_at: now,
        },
        {
          onConflict: "firm_id",
        },
      );

    if (upsertError) {
      return bad(upsertError.message, 500);
    }

    await supabaseAdmin.from("billing_events").insert({
      firm_id: firmId,
      stripe_event_id: `local_checkout_session_${checkoutSession.id}`,
      stripe_event_type: "checkout.session.created.local",
      payload: {
        checkoutSessionId: checkoutSession.id,
        url: checkoutSession.url,
        firmId,
        planId: plan.id,
        planCode: plan.code,
        userId: user.id,
      },
      processed: true,
      processed_at: now,
    });

    return NextResponse.json({
      success: true,
      checkoutSessionId: checkoutSession.id,
      url: checkoutSession.url,
      firmId,
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        monthlyPriceGbp: plan.monthly_price_gbp,
        maxClients: plan.max_clients,
        maxTeamMembers: plan.max_team_members,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create Stripe checkout session.",
      },
      { status: 500 },
    );
  }
}