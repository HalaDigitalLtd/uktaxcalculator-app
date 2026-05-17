import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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

async function getPlan(planSlug: string) {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .eq("slug", planSlug)
    .eq("is_active", true)
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
    const body = await req.json();

    const registrationId = String(body.registrationId || "").trim();
    const planSlug = String(body.planSlug || "practice").toLowerCase();

    if (!registrationId) {
      return NextResponse.json(
        { success: false, message: "Missing onboarding registration." },
        { status: 400 }
      );
    }

    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("onboarding_registrations")
      .select("*")
      .eq("id", registrationId)
      .maybeSingle();

    if (registrationError) throw registrationError;

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Registration not found." },
        { status: 404 }
      );
    }

    if (!registration.email_verified_at) {
      return NextResponse.json(
        { success: false, message: "Please verify your email before checkout." },
        { status: 403 }
      );
    }

    if (registration.workspace_provisioned_at || registration.provisioned_firm_id) {
      return NextResponse.json(
        { success: false, message: "Workspace already provisioned." },
        { status: 409 }
      );
    }

    if (registration.status === "cancelled" || registration.status === "expired") {
      return NextResponse.json(
        { success: false, message: "This onboarding registration is no longer active." },
        { status: 410 }
      );
    }

    const plan = await getPlan(planSlug);
    const stripe = getStripe();
    const origin = originFromRequest(req);
    const now = new Date().toISOString();

    let customerId = registration.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: registration.email,
        name: registration.firm_name,
        metadata: {
          onboarding_registration_id: registration.id,
          authorised_contact_name: registration.authorised_contact_name,
          source: "hala_digital_public_onboarding",
        },
      });

      customerId = customer.id;
    }

    const { error: updateStartedError } = await supabaseAdmin
      .from("onboarding_registrations")
      .update({
        selected_plan_slug: plan.slug,
        selected_plan_id: plan.planId,
        stripe_customer_id: customerId,
        stripe_price_id: plan.stripePriceId,
        status: "checkout_started",
        payment_status: "checkout_started",
        checkout_started_at: now,
        metadata: {
          ...(registration.metadata || {}),
          checkout_started_at: now,
          selected_plan_slug: plan.slug,
          stripe_price_id: plan.stripePriceId,
        },
      })
      .eq("id", registration.id);

    if (updateStartedError) throw updateStartedError;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/onboarding/success?registration=${registration.id}`,
      cancel_url: `${origin}/auth/register?checkout=cancelled&registration=${registration.id}`,
      subscription_data: {
        metadata: {
          onboarding_registration_id: registration.id,
          plan_slug: plan.slug,
          source: "hala_digital_public_onboarding",
        },
      },
      metadata: {
        onboarding_registration_id: registration.id,
        plan_slug: plan.slug,
        source: "hala_digital_public_onboarding",
      },
      allow_promotion_codes: true,
    });

    const { error: updateSessionError } = await supabaseAdmin
      .from("onboarding_registrations")
      .update({
        stripe_checkout_session_id: session.id,
        metadata: {
          ...(registration.metadata || {}),
          checkout_started_at: now,
          selected_plan_slug: plan.slug,
          stripe_price_id: plan.stripePriceId,
          stripe_checkout_session_id: session.id,
        },
      })
      .eq("id", registration.id);

    if (updateSessionError) throw updateSessionError;

    await supabaseAdmin.from("billing_events").insert({
      firm_id: null,
      event_type: "onboarding_checkout_session_created",
      stripe_customer_id: customerId,
      status: "pending",
      payload: {
        onboardingRegistrationId: registration.id,
        checkoutSessionId: session.id,
        planSlug: plan.slug,
        stripePriceId: plan.stripePriceId,
      },
      created_at: now,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      registrationId: registration.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to create onboarding checkout session.",
      },
      { status: 500 }
    );
  }
}
