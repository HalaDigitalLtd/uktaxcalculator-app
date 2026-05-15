import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

type BillingStatus =
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "unpaid"
  | "paused"
  | "expired"
  | "unknown";

function toIsoFromUnix(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function normaliseStripeSubscriptionStatus(
  status: Stripe.Subscription.Status | string | null | undefined
): BillingStatus {
  if (!status) return "unknown";

  const allowed: BillingStatus[] = [
    "trialing",
    "active",
    "past_due",
    "incomplete",
    "incomplete_expired",
    "canceled",
    "unpaid",
    "paused",
  ];

  return allowed.includes(status as BillingStatus)
    ? (status as BillingStatus)
    : "unknown";
}

function getGracePeriodEndsAt(status: BillingStatus) {
  if (status === "past_due" || status === "unpaid") {
    const graceDays = Number(process.env.BILLING_GRACE_PERIOD_DAYS || "7");
    const date = new Date();
    date.setDate(date.getDate() + graceDays);
    return date.toISOString();
  }

  return null;
}

async function recordBillingEvent(params: {
  firmId: string | null;
  stripeEventId: string;
  stripeEventType: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status?: string | null;
  eventPayload: unknown;
}) {
  await supabaseAdmin.from("billing_events").insert({
    firm_id: params.firmId,
    stripe_event_id: params.stripeEventId,
    event_type: params.stripeEventType,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    status: params.status ?? "received",
    payload: params.eventPayload,
    created_at: new Date().toISOString(),
  });
}

async function findFirmIdFromCustomerOrSubscription(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  if (!params.stripeCustomerId && !params.stripeSubscriptionId) return null;

  let query = supabaseAdmin
    .from("firm_subscriptions")
    .select("firm_id")
    .limit(1);

  if (params.stripeSubscriptionId) {
    query = query.eq("stripe_subscription_id", params.stripeSubscriptionId);
  } else {
    query = query.eq("stripe_customer_id", params.stripeCustomerId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Billing firm lookup failed", error);
    return null;
  }

  return data?.firm_id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const stripeSubscriptionId = subscription.id;
  const status = normaliseStripeSubscriptionStatus(subscription.status);

  const firmId =
    subscription.metadata?.firm_id ||
    (await findFirmIdFromCustomerOrSubscription({
      stripeCustomerId,
      stripeSubscriptionId,
    }));

  if (!firmId) {
    return {
      synced: false,
      reason: "firm_id_not_found",
      firmId: null,
      status,
    };
  }

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const productIdRaw = firstItem?.price?.product;
  const productId =
    typeof productIdRaw === "string" ? productIdRaw : productIdRaw?.id ?? null;

  const currentPeriodStart = toIsoFromUnix(firstItem?.current_period_start);
  const currentPeriodEnd = toIsoFromUnix(firstItem?.current_period_end);

  const gracePeriodEndsAt = getGracePeriodEndsAt(status);

  const { error } = await supabaseAdmin.from("firm_subscriptions").upsert(
    {
      firm_id: firmId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId,
      stripe_product_id: productId,
      status,
      billing_status: status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      trial_start: toIsoFromUnix(subscription.trial_start),
      trial_end: toIsoFromUnix(subscription.trial_end),
      cancel_at: toIsoFromUnix(subscription.cancel_at),
      canceled_at: toIsoFromUnix(subscription.canceled_at),
      grace_period_ends_at: gracePeriodEndsAt,
      latest_stripe_payload: subscription,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id" }
  );

  if (error) throw error;

  return {
    synced: true,
    reason: null,
    firmId,
    status,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const firmId = session.metadata?.firm_id ?? null;

  if (!firmId) {
    return {
      synced: false,
      reason: "missing_firm_id_metadata",
      firmId: null,
      status: "pending",
    };
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    return syncSubscription(subscription);
  }

  const { error } = await supabaseAdmin.from("firm_subscriptions").upsert(
    {
      firm_id: firmId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: "pending",
      billing_status: "pending",
      latest_checkout_session_id: session.id,
      latest_stripe_payload: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id" }
  );

  if (error) throw error;

  return {
    synced: true,
    reason: null,
    firmId,
    status: "pending",
  };
}

export async function POST(request: NextRequest) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 400 }
    );
  }

  try {
    const existing = await supabaseAdmin
      .from("billing_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existing.data?.id) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    let result = {
      synced: false,
      reason: "event_not_handled" as string | null,
      firmId: null as string | null,
      status: null as string | null,
    };

    if (event.type === "checkout.session.completed") {
      result = await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      result = await syncSubscription(event.data.object as Stripe.Subscription);
    }

    const object = event.data.object as any;

    await recordBillingEvent({
      firmId: result.firmId,
      stripeEventId: event.id,
      stripeEventType: event.type,
      stripeCustomerId:
        typeof object.customer === "string"
          ? object.customer
          : object.customer?.id ?? null,
      stripeSubscriptionId:
        object.object === "subscription"
          ? object.id
          : typeof object.subscription === "string"
            ? object.subscription
            : object.subscription?.id ?? null,
      status: result.status ?? result.reason ?? "received",
      eventPayload: event,
    });

    return NextResponse.json({
      received: true,
      handled: result.synced,
      reason: result.reason,
    });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);

    return NextResponse.json(
      { error: "Stripe webhook processing failed" },
      { status: 500 }
    );
  }
}
