import { supabaseAdmin } from "../supabaseAdmin";
import {
  DEFAULT_PLAN_CAPABILITIES,
  BillingFeature,
  normalisePlanSlug,
} from "./planCapabilities";

export type FirmBillingAccess = {
  firmId: string;
  allowed: boolean;
  reason: string | null;
  billingStatus: string;
  accessStatus: string;
  planSlug: string;
  gracePeriodEndsAt: string | null;
  limits: {
    clientLimit: number;
    staffLimit: number;
    monthlySubmissionLimit: number;
    storageMbLimit: number;
  };
  usage: {
    clients: number;
    staff: number;
    monthlySubmissions: number;
  };
  features: Record<string, boolean>;
};

function nowIso() {
  return new Date().toISOString();
}

function isGraceStillValid(gracePeriodEndsAt: string | null) {
  if (!gracePeriodEndsAt) return false;
  return new Date(gracePeriodEndsAt).getTime() > Date.now();
}

function billingStatusAllowsAccess(
  status: string | null,
  gracePeriodEndsAt: string | null
) {
  const normalised = String(status || "").toLowerCase();

  if (normalised === "active" || normalised === "trialing") return true;
  if (normalised === "past_due" && isGraceStillValid(gracePeriodEndsAt)) {
    return true;
  }

  return false;
}

async function countFirmClients(firmId: string) {
  const { count, error } = await supabaseAdmin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId);

  if (error) throw error;
  return count || 0;
}

async function countFirmStaff(firmId: string) {
  const { count, error } = await supabaseAdmin
    .from("firm_users")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId)
    .eq("status", "active");

  if (error) throw error;
  return count || 0;
}

async function countMonthlySubmissions(firmId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("billing_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId)
    .eq("event_type", "hmrc_submission")
    .gte("created_at", start.toISOString());

  if (error) throw error;
  return count || 0;
}

export async function getFirmBillingAccess(
  firmId: string
): Promise<FirmBillingAccess> {
  const { data: subscription, error } = await supabaseAdmin
    .from("firm_subscriptions")
    .select(
      `
      firm_id,
      status,
      billing_status,
      access_status,
      grace_period_ends_at,
      subscription_plans (
        slug,
        client_limit,
        staff_limit,
        monthly_submission_limit,
        storage_mb_limit,
        features
      )
    `
    )
    .eq("firm_id", firmId)
    .maybeSingle();

  if (error) throw error;

  const planRow: any = Array.isArray(subscription?.subscription_plans)
    ? subscription?.subscription_plans[0]
    : subscription?.subscription_plans;

  const planSlug = normalisePlanSlug(planRow?.slug);
  const defaultPlan = DEFAULT_PLAN_CAPABILITIES[planSlug];

  const billingStatus = String(
    subscription?.billing_status || subscription?.status || "inactive"
  );

  const gracePeriodEndsAt = subscription?.grace_period_ends_at || null;

  const clients = await countFirmClients(firmId);
  const staff = await countFirmStaff(firmId);
  const monthlySubmissions = await countMonthlySubmissions(firmId);

  const features = {
    ...defaultPlan.features,
    ...(planRow?.features || {}),
  };

  const limits = {
    clientLimit: Number(planRow?.client_limit || defaultPlan.clientLimit),
    staffLimit: Number(planRow?.staff_limit || defaultPlan.staffLimit),
    monthlySubmissionLimit: Number(
      planRow?.monthly_submission_limit || defaultPlan.monthlySubmissionLimit
    ),
    storageMbLimit: Number(
      planRow?.storage_mb_limit || defaultPlan.storageMbLimit
    ),
  };

  const allowedByStatus = billingStatusAllowsAccess(
    billingStatus,
    gracePeriodEndsAt
  );

  let reason: string | null = null;

  if (!subscription) reason = "no_subscription";
  else if (!allowedByStatus) reason = `billing_status_${billingStatus}`;
  else if (clients > limits.clientLimit) reason = "client_limit_exceeded";
  else if (staff > limits.staffLimit) reason = "staff_limit_exceeded";
  else if (monthlySubmissions > limits.monthlySubmissionLimit) {
    reason = "monthly_submission_limit_exceeded";
  }

  const allowed = !reason;

  await supabaseAdmin
    .from("firm_subscriptions")
    .update({
      access_status: allowed ? "active" : "restricted",
      access_locked_at: allowed ? null : nowIso(),
      access_lock_reason: reason,
      usage_snapshot: {
        clients,
        staff,
        monthlySubmissions,
        checkedAt: nowIso(),
      },
      updated_at: nowIso(),
    })
    .eq("firm_id", firmId);

  return {
    firmId,
    allowed,
    reason,
    billingStatus,
    accessStatus: allowed ? "active" : "restricted",
    planSlug,
    gracePeriodEndsAt,
    limits,
    usage: {
      clients,
      staff,
      monthlySubmissions,
    },
    features,
  };
}

export async function assertFirmBillingAccess(firmId: string) {
  const access = await getFirmBillingAccess(firmId);

  if (!access.allowed) {
    throw new Error(`Firm billing access restricted: ${access.reason}`);
  }

  return access;
}

export async function assertFirmFeatureAccess(
  firmId: string,
  feature: BillingFeature
) {
  const access = await assertFirmBillingAccess(firmId);

  if (!access.features[feature]) {
    throw new Error(`Feature not available on current plan: ${feature}`);
  }

  return access;
}

export async function recordBillingUsageEvent(params: {
  firmId: string;
  eventType:
    | "hmrc_submission"
    | "client_created"
    | "staff_invited"
    | "storage_used";
  quantity?: number;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("billing_usage_events").insert({
    firm_id: params.firmId,
    event_type: params.eventType,
    quantity: params.quantity || 1,
    resource_id: params.resourceId || null,
    metadata: params.metadata || {},
  });

  if (error) throw error;
}
