import { supabaseAdmin } from "../supabaseAdmin";

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

export async function provisionWorkspaceFromOnboardingRegistration(params: {
  registrationId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
  stripePayload: unknown;
}) {
  const now = new Date().toISOString();

  const { data: registration, error: registrationError } = await supabaseAdmin
    .from("onboarding_registrations")
    .select("*")
    .eq("id", params.registrationId)
    .maybeSingle();

  if (registrationError) throw registrationError;
  if (!registration) throw new Error("Onboarding registration not found.");

  if (registration.workspace_provisioned_at && registration.provisioned_firm_id) {
    return {
      firmId: registration.provisioned_firm_id,
      alreadyProvisioned: true,
    };
  }

  if (!registration.auth_user_id) {
    throw new Error("Onboarding registration has no auth user.");
  }

  if (!registration.email_verified_at) {
    throw new Error("Email must be verified before workspace provisioning.");
  }

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("id")
    .eq("stripe_price_id", params.stripePriceId)
    .maybeSingle();

  const { data: firm, error: firmError } = await supabaseAdmin
    .from("firms")
    .insert({
      name: registration.firm_name,
      slug: buildFirmSlug(registration.firm_name),
      onboarding_status: "billing_active",
      onboarding_completed_at: now,
      onboarding_metadata: {
        source: "payment_first_onboarding",
        onboarding_registration_id: registration.id,
        primary_contact_email: registration.email,
        phone: registration.phone,
        authorised_contact_name: registration.authorised_contact_name,
        professional_body: registration.professional_body,
        practice_type: registration.practice_type,
        estimated_client_count: registration.estimated_client_count,
        country: registration.country,
        payment_required_before_workspace: true,
        workspace_provisioned_at: now,
      },
    })
    .select("id")
    .single();

  if (firmError || !firm) {
    throw new Error(firmError?.message || "Unable to provision firm.");
  }

  const { error: membershipError } = await supabaseAdmin
    .from("firm_users")
    .insert({
      firm_id: firm.id,
      user_id: registration.auth_user_id,
      email: registration.email,
      role: "admin",
      is_active: true,
      status: "active",
      approved_by: registration.auth_user_id,
      meta: {
        source: "payment_first_onboarding",
        onboarding_registration_id: registration.id,
        authorised_contact_name: registration.authorised_contact_name,
        membership_status: "owner_admin",
        accepted_at: now,
      },
    });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const { error: subscriptionError } = await supabaseAdmin
    .from("firm_subscriptions")
    .upsert(
      {
        firm_id: firm.id,
        plan_id: plan?.id || registration.selected_plan_id || null,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        stripe_price_id: params.stripePriceId,
        stripe_product_id: params.stripeProductId,
        status: "active",
        billing_status: "active",
        access_status: "active",
        onboarding_status: "workspace_provisioned",
        billing_lifecycle_state: "active",
        latest_stripe_payload: params.stripePayload,
        onboarding_metadata: {
          source: "payment_first_onboarding",
          onboarding_registration_id: registration.id,
          workspace_provisioned_at: now,
        },
        updated_at: now,
      },
      { onConflict: "firm_id" }
    );

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  const { error: updateRegistrationError } = await supabaseAdmin
    .from("onboarding_registrations")
    .update({
      status: "active",
      payment_status: "paid",
      provisioning_status: "completed",
      payment_confirmed_at: now,
      workspace_provisioned_at: now,
      provisioned_firm_id: firm.id,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_price_id: params.stripePriceId,
      metadata: {
        ...(registration.metadata || {}),
        workspace_provisioned_at: now,
        provisioned_firm_id: firm.id,
        stripe_subscription_id: params.stripeSubscriptionId,
      },
    })
    .eq("id", registration.id);

  if (updateRegistrationError) {
    throw new Error(updateRegistrationError.message);
  }

  return {
    firmId: firm.id,
    alreadyProvisioned: false,
  };
}
