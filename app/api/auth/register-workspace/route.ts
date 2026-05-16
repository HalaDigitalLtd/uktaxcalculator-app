import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const TRIAL_DAYS = 14;

function buildFirmSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") +
    "-" +
    Date.now()
  );
}

function buildTrialEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + TRIAL_DAYS);
  return date.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const firmName = String(body.firmName || "").trim();

    if (!email || !password || !firmName) {
      return NextResponse.json(
        { success: false, message: "Missing registration details." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Unable to create user.");
    }

    const userId = authData.user.id;

    const { data: firm, error: firmError } = await supabaseAdmin
      .from("firms")
      .insert({
        name: firmName,
        slug: buildFirmSlug(firmName),
        onboarding_status: "trial_provisioned",
        onboarding_completed_at: new Date().toISOString(),
        onboarding_metadata: {
          source: "self_registration",
          onboarding_version: 1,
          registration_completed_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (firmError || !firm) {
      throw new Error(firmError?.message || "Unable to create firm.");
    }

    const { error: membershipError } = await supabaseAdmin
      .from("firm_users")
      .insert({
        firm_id: firm.id,
        user_id: userId,
        email,
        role: "admin",
        is_active: true,
        status: "active",
        approved_by: userId,
        meta: {
          source: "firm_registration",
          membership_status: "accepted",
          accepted_at: new Date().toISOString(),
        },
      });

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const { data: starterPlan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("slug", "starter")
      .maybeSingle();

    if (planError) {
      throw new Error(planError.message);
    }

    if (!starterPlan?.id) {
      throw new Error("Starter subscription plan is not configured.");
    }

    const { error: subscriptionError } = await supabaseAdmin
      .from("firm_subscriptions")
      .upsert(
        {
          firm_id: firm.id,
          plan_id: starterPlan.id,
          status: "trialing",
          billing_status: "trialing",
          access_status: "active",
          onboarding_status: "trial_active",
          billing_lifecycle_state: "trial",
          trial_started_at: new Date().toISOString(),
          trial_ends_at: buildTrialEndDate(),
          onboarding_metadata: {
            source: "self_registration",
            auto_trial_provisioned: true,
            trial_days: TRIAL_DAYS,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "firm_id" }
      );

    if (subscriptionError) {
      throw new Error(subscriptionError.message);
    }

    return NextResponse.json({
      success: true,
      firmId: firm.id,
      userId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Registration failed.",
      },
      { status: 500 }
    );
  }
}
