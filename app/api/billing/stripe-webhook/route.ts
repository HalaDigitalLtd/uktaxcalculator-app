import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  return new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
  });
}

function nowIso() {
  return new Date().toISOString();
}

function toIsoFromUnix(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function normaliseStatus(
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

function statusAllowsAccess(status: BillingStatus) {
  return status === "active" || status === "trialing";
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

function getCustomerId(object: any) {
  return typeof object?.customer === "string"
    ? object.customer
    : object?.customer?.id ?? null;
}

function getSubscriptionId(object: any) {
  if (object?.object === "subscription") return object.id;
  return typeof object?.subscription === "string"
    ? object.subscription
    : object?.subscription?.id ?? null;
}

function getInvoiceId(object: any) {
  if (object?.object === "invoice") return object.id;
  return typeof object?.invoice === "string"
    ? object.invoice
    : object?.invoice?.id ?? null;
}

function getPaymentIntentId(object: any) {
  return typeof object?.payment_intent === "string"
    ? object.payment_intent
    : object?.payment_intent?.id ?? null;
}

async function findFirmId(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  if (!params.stripeCustomerId && !params.stripeSubscriptionId) return null;

  let query = supabaseAdmin.from("firm_subscriptions").select("firm_id").limit(1);

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

async function getPlanIdFromPrice(priceId: string | null) {
  if (!priceId) return null;

  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (error) {
    console.error("Plan lookup failed", error);
    return null;
  }

  return data?.id ?? null;
}

async function getExistingSubscription(firmId: string) {
  const { data, error } = await supabaseAdmin
    .from("firm_subscriptions")
    .select("status,billing_status,stripe_price_id,plan_id")
    .eq("firm_id", firmId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createReceipt(event: Stripe.Event) {
  const object = event.data.object as any;
  const stripeCustomerId = getCustomerId(object);
  const stripeSubscriptionId = getSubscriptionId(object);
  const stripeInvoiceId = getInvoiceId(object);
  const stripePaymentIntentId = getPaymentIntentId(object);

  const firmId =
    object?.metadata?.firm_id ||
    (await findFirmId({ stripeCustomerId, stripeSubscriptionId }));

  const { data: existing } = await supabaseAdmin
    .from("billing_event_receipts")
    .select("id,processing_status,processing_attempts")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin
      .from("billing_event_receipts")
      .update({
        processing_attempts: Number(existing.processing_attempts || 1) + 1,
        last_processed_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", existing.id);

    return {
      duplicate: true,
      receiptId: existing.id,
      firmId: firmId ?? null,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeInvoiceId,
      stripePaymentIntentId,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("billing_event_receipts")
    .insert({
      firm_id: firmId ?? null,
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_invoice_id: stripeInvoiceId,
      stripe_payment_intent_id: stripePaymentIntentId,
      processing_status: "received",
      payload: event,
      metadata: {
        livemode: event.livemode,
        api_version: event.api_version,
        created: event.created,
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("id")
    .single();

  if (error) throw error;

  return {
    duplicate: false,
    receiptId: data.id,
    firmId: firmId ?? null,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeInvoiceId,
    stripePaymentIntentId,
  };
}

async function markReceipt(
  receiptId: string,
  status: "processed" | "failed" | "ignored",
  error?: string | null
) {
  await supabaseAdmin
    .from("billing_event_receipts")
    .update({
      processing_status: status,
      processed_at: status === "processed" ? nowIso() : null,
      last_processed_at: nowIso(),
      processing_error: error || null,
      updated_at: nowIso(),
    })
    .eq("id", receiptId);
}

async function recordBillingEvent(params: {
  firmId: string | null;
  event: Stripe.Event;
  status?: string | null;
  processingStatus?: string | null;
  error?: string | null;
}) {
  const object = params.event.data.object as any;

  await supabaseAdmin.from("billing_events").insert({
    firm_id: params.firmId,
    stripe_event_id: params.event.id,
    event_type: params.event.type,
    stripe_customer_id: getCustomerId(object),
    stripe_subscription_id: getSubscriptionId(object),
    stripe_invoice_id: getInvoiceId(object),
    stripe_payment_intent_id: getPaymentIntentId(object),
    status: params.status || "received",
    processing_status: params.processingStatus || "processed",
    processing_error: params.error || null,
    processed_at: nowIso(),
    source: "stripe_webhook",
    payload: params.event,
    created_at: nowIso(),
  });
}

async function recordTransition(params: {
  firmId: string;
  subscriptionId: string | null;
  fromStatus: string | null;
  toStatus: string;
  fromPriceId: string | null;
  toPriceId: string | null;
  fromPlanId: string | null;
  toPlanId: string | null;
  reason: string;
  stripeEventId: string;
  payload: unknown;
}) {
  if (
    params.fromStatus === params.toStatus &&
    params.fromPriceId === params.toPriceId &&
    params.fromPlanId === params.toPlanId
  ) {
    return;
  }

  await supabaseAdmin.from("billing_subscription_transitions").insert({
    firm_id: params.firmId,
    stripe_subscription_id: params.subscriptionId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    from_price_id: params.fromPriceId,
    to_price_id: params.toPriceId,
    from_plan_id: params.fromPlanId,
    to_plan_id: params.toPlanId,
    reason: params.reason,
    stripe_event_id: params.stripeEventId,
    payload: params.payload,
    created_at: nowIso(),
  });
}

async function syncSubscription(subscription: Stripe.Subscription, event: Stripe.Event) {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const stripeSubscriptionId = subscription.id;
  const status = normaliseStatus(subscription.status);

  const firmId =
    subscription.metadata?.firm_id ||
    (await findFirmId({ stripeCustomerId, stripeSubscriptionId }));

  if (!firmId) {
    return { synced: false, reason: "firm_id_not_found", firmId: null, status };
  }

  const existing = await getExistingSubscription(firmId);
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const productRaw = firstItem?.price?.product;
  const productId = typeof productRaw === "string" ? productRaw : productRaw?.id ?? null;
  const planId = await getPlanIdFromPrice(priceId);
  const accessStatus = statusAllowsAccess(status) ? "active" : "restricted";
  const gracePeriodEndsAt = getGracePeriodEndsAt(status);

  await supabaseAdmin.from("firm_subscriptions").upsert(
    {
      firm_id: firmId,
      plan_id: planId || existing?.plan_id || null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId,
      stripe_product_id: productId,
      status,
      billing_status: status,
      access_status: accessStatus,
      access_locked_at: statusAllowsAccess(status) ? null : nowIso(),
      access_lock_reason: statusAllowsAccess(status) ? null : `billing_status_${status}`,
      current_period_start: toIsoFromUnix(firstItem?.current_period_start),
      current_period_end: toIsoFromUnix(firstItem?.current_period_end),
      trial_start: toIsoFromUnix(subscription.trial_start),
      trial_end: toIsoFromUnix(subscription.trial_end),
      cancel_at: toIsoFromUnix(subscription.cancel_at),
      canceled_at: toIsoFromUnix(subscription.canceled_at),
      grace_period_ends_at: gracePeriodEndsAt,
      billing_lifecycle_state: status,
      billing_state_changed_at:
        existing?.billing_status !== status || existing?.stripe_price_id !== priceId
          ? nowIso()
          : undefined,
      onboarding_status: statusAllowsAccess(status) ? "billing_active" : "billing_pending",
      latest_stripe_payload: subscription,
      updated_at: nowIso(),
    },
    { onConflict: "firm_id" }
  );

  await recordTransition({
    firmId,
    subscriptionId: stripeSubscriptionId,
    fromStatus: existing?.billing_status || existing?.status || null,
    toStatus: status,
    fromPriceId: existing?.stripe_price_id || null,
    toPriceId: priceId,
    fromPlanId: existing?.plan_id || null,
    toPlanId: planId,
    reason: event.type,
    stripeEventId: event.id,
    payload: subscription,
  });

  return { synced: true, reason: null, firmId, status };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, event: Stripe.Event) {
  const stripe = getStripe();
  const firmId = session.metadata?.firm_id ?? null;

  if (!firmId) {
    return { synced: false, reason: "missing_firm_id_metadata", firmId: null, status: "pending" };
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    return syncSubscription(subscription, event);
  }

  await supabaseAdmin.from("firm_subscriptions").upsert(
    {
      firm_id: firmId,
      stripe_customer_id: getCustomerId(session),
      stripe_subscription_id: subscriptionId,
      status: "pending",
      billing_status: "pending",
      access_status: "restricted",
      access_lock_reason: "checkout_pending",
      latest_checkout_session_id: session.id,
      latest_stripe_payload: session,
      updated_at: nowIso(),
    },
    { onConflict: "firm_id" }
  );

  return { synced: true, reason: null, firmId, status: "pending" };
}

async function handleInvoice(invoice: Stripe.Invoice, event: Stripe.Event) {
  const stripeCustomerId = getCustomerId(invoice);
  const stripeSubscriptionId = getSubscriptionId(invoice);
  const firmId = await findFirmId({ stripeCustomerId, stripeSubscriptionId });

  if (!firmId) {
    return { synced: false, reason: "firm_id_not_found_for_invoice", firmId: null, status: invoice.status || "unknown" };
  }

  const isPaid = event.type === "invoice.paid" || invoice.status === "paid";

  await supabaseAdmin
    .from("firm_subscriptions")
    .update({
      latest_invoice_id: invoice.id,
      latest_invoice_status: invoice.status || null,
      latest_payment_intent_id: getPaymentIntentId(invoice),
      latest_payment_status: isPaid ? "paid" : "failed",
      last_payment_succeeded_at: isPaid ? nowIso() : undefined,
      last_payment_failed_at: isPaid ? undefined : nowIso(),
      updated_at: nowIso(),
    })
    .eq("firm_id", firmId);

  return {
    synced: true,
    reason: null,
    firmId,
    status: isPaid ? "invoice_paid" : "invoice_payment_failed",
  };
}

async function handleTrialWillEnd(subscription: Stripe.Subscription, event: Stripe.Event) {
  const result = await syncSubscription(subscription, event);

  if (result.firmId) {
    await supabaseAdmin
      .from("firm_subscriptions")
      .update({
        trial_will_end_notified_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("firm_id", result.firmId);
  }

  return {
    ...result,
    status: "trial_will_end",
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe webhook signature" }, { status: 400 });
  }

  const receipt = await createReceipt(event);

  if (receipt.duplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let result = {
      synced: false,
      reason: "event_not_handled" as string | null,
      firmId: receipt.firmId,
      status: "ignored" as string | null,
    };

    if (event.type === "checkout.session.completed") {
      result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      result = await syncSubscription(event.data.object as Stripe.Subscription, event);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      result = await handleInvoice(event.data.object as Stripe.Invoice, event);
    } else if (event.type === "customer.subscription.trial_will_end") {
      result = await handleTrialWillEnd(event.data.object as Stripe.Subscription, event);
    }

    await recordBillingEvent({
      firmId: result.firmId,
      event,
      status: result.status || result.reason,
      processingStatus: result.synced ? "processed" : "ignored",
    });

    await markReceipt(receipt.receiptId, result.synced ? "processed" : "ignored");

    return NextResponse.json({
      received: true,
      handled: result.synced,
      reason: result.reason,
    });
  } catch (error: any) {
    console.error("Stripe webhook processing failed", error);

    await markReceipt(
      receipt.receiptId,
      "failed",
      error?.message || "stripe_webhook_processing_failed"
    );

    await recordBillingEvent({
      firmId: receipt.firmId,
      event,
      status: "failed",
      processingStatus: "failed",
      error: error?.message || "stripe_webhook_processing_failed",
    });

    return NextResponse.json({ error: "Stripe webhook processing failed" }, { status: 500 });
  }
}
