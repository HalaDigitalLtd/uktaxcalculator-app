import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { DEFAULT_PLAN_CAPABILITIES } from "../../../../lib/billing/planCapabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENV_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  practice: process.env.STRIPE_PRICE_PRACTICE,
  scale: process.env.STRIPE_PRICE_SCALE,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;

    const dbPlans = (data || []).map((plan: any) => ({
      slug: plan.slug,
      name: plan.name || plan.slug,
      description: plan.description || "",
      stripePriceId: plan.stripe_price_id || ENV_PRICE_IDS[plan.slug] || null,
      monthlyPriceGbp: plan.monthly_price_gbp || null,
      clientLimit: plan.client_limit,
      staffLimit: plan.staff_limit,
      monthlySubmissionLimit: plan.monthly_submission_limit,
      storageMbLimit: plan.storage_mb_limit,
      features: plan.features || {},
    }));

    if (dbPlans.length > 0) {
      return NextResponse.json({ success: true, plans: dbPlans });
    }

    const fallbackPlans = Object.values(DEFAULT_PLAN_CAPABILITIES).map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      description: `${plan.clientLimit} clients, ${plan.staffLimit} staff users`,
      stripePriceId: ENV_PRICE_IDS[plan.slug] || null,
      monthlyPriceGbp: null,
      clientLimit: plan.clientLimit,
      staffLimit: plan.staffLimit,
      monthlySubmissionLimit: plan.monthlySubmissionLimit,
      storageMbLimit: plan.storageMbLimit,
      features: plan.features,
    }));

    return NextResponse.json({ success: true, plans: fallbackPlans });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load plans" },
      { status: 500 }
    );
  }
}
