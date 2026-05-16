import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getAuthenticatedUserFromRequest } from "../../../../lib/hmrc/tenantSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  return new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
  });
}

function isActive(status: string) {
  return status === "active" || status === "trialing";
}

async function getMembership(userId: string, firmId?: string | null) {
  let query = supabaseAdmin
    .from("firm_users")
    .select("firm_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (firmId) query = query.eq("firm_id", firmId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const requestedFirmId = body?.firmId ? String(body.firmId) : null;

    const membership = await getMembership(user.id, requestedFirmId);

    if (!membership?.firm_id) {
      return NextResponse.json(
        { success: false, error: "No active firm membership found" },
        { status: 403 }
      );
    }

    const firmId = membership.firm_id;

    const { data: firmSubscription, error: subError } = await supabaseAdmin
      .from("firm_subscriptions")
      .select("stripe_customer_id")
      .eq("firm_id", firmId)
      .maybeSingle();

    if (subError) throw subError;

    if (!firmSubscription?.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        reconciled: false,
        reason: "no_stripe_customer",
      });
    }

    const stripe = getStripe();

    const subscriptions = await stripe.subscriptions.list({
      customer: firmSubscription.stripe_customer_id,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const subscription =
      subscriptions.data.find((s) => isActive(s.status)) ||
      subscriptions.data[0] ||
      null;

    if (!subscription) {
      return NextResponse.json({
        success: true,
        reconciled: false,
        reason: "no_subscription_found",
      });
    }

    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price?.id ?? null;
    const productRaw = firstItem?.price?.product;
    const productId =
      typeof productRaw === "string" ? productRaw : productRaw?.id ?? null;

    const status = subscription.status;
    const accessStatus = isActive(status) ? "active" : "restricted";

    const { error: updateError } = await supabaseAdmin
      .from("firm_subscriptions")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_product_id: productId,
        status,
        billing_status: status,
        access_status: accessStatus,
        access_locked_at: isActive(status) ? null : new Date().toISOString(),
        access_lock_reason: isActive(status) ? null : `billing_status_${status}`,
        current_period_start: firstItem?.current_period_start
          ? new Date(firstItem.current_period_start * 1000).toISOString()
          : null,
        current_period_end: firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : null,
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        onboarding_status: isActive(status) ? "billing_active" : "billing_pending",
        latest_stripe_payload: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("firm_id", firmId);

    if (updateError) throw updateError;

    await supabaseAdmin.from("billing_events").insert({
      firm_id: firmId,
      event_type: "subscription_reconciled",
      stripe_customer_id: firmSubscription.stripe_customer_id,
      stripe_subscription_id: subscription.id,
      status,
      payload: {
        source: "billing_reconcile_route",
        subscription,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      reconciled: true,
      billingStatus: status,
      accessStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to reconcile subscription",
      },
      { status: 500 }
    );
  }
}
