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
    storageMbUsed: number;
  };
  features: Record<string, boolean>;
};

function nowIso() {
  return new Date().toISOString();
}

function currentBillingMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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

async function estimateStorageUsedMb(firmId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_usage_events")
    .select("quantity")
    .eq("firm_id", firmId)
    .eq("event_type", "storage_used");

  if (error) throw error;

  return (data || []).reduce(
    (sum: number, row: any) => sum + Number(row.quantity || 0),
    0
  );
}

async function createWarningIfNeeded(params: {
  firmId: string;
  warningType: string;
  usageValue: number;
  limitValue: number;
}) {
  if (!params.limitValue || params.limitValue <= 0) return;

  const percentageUsed = Math.round(
    (params.usageValue / params.limitValue) * 100
  );

  if (percentageUsed < 80) return;

  const { data: existing } = await supabaseAdmin
    .from("billing_limit_warnings")
    .select("id")
    .eq("firm_id", params.firmId)
    .eq("warning_type", params.warningType)
    .gte(
      "created_at",
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()
    )
    .maybeSingle();

  if (existing?.id) return;

  await supabaseAdmin.from("billing_limit_warnings").insert({
    firm_id: params.firmId,
    warning_type: params.warningType,
    usage_value: params.usageValue,
    limit_value: params.limitValue,
    percentage_used: percentageUsed,
    metadata: {
      generatedBy: "billing_access_control",
      billingMonth: currentBillingMonth(),
    },
    created_at: nowIso(),
  });
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
      enforcement_enabled,
      soft_limit_mode,
      warning_threshold_percent,
      hard_stop_threshold_percent,
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
    ? subscription.subscription_plans[0]
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
  const storageMbUsed = await estimateStorageUsedMb(firmId);

  const limits = {
    clientLimit: Number(planRow?.client_limit || defaultPlan.clientLimit),
    staffLimit: Number(planRow?.staff_limit || defaultPlan.staffLimit),
    monthlySubmissionLimit: Number(
      planRow?.monthly_submission_limit ||
        defaultPlan.monthlySubmissionLimit
    ),
    storageMbLimit: Number(
      planRow?.storage_mb_limit || defaultPlan.storageMbLimit
    ),
  };

  await createWarningIfNeeded({
    firmId,
    warningType: "client_limit",
    usageValue: clients,
    limitValue: limits.clientLimit,
  });

  await createWarningIfNeeded({
    firmId,
    warningType: "staff_limit",
    usageValue: staff,
    limitValue: limits.staffLimit,
  });

  await createWarningIfNeeded({
    firmId,
    warningType: "submission_limit",
    usageValue: monthlySubmissions,
    limitValue: limits.monthlySubmissionLimit,
  });

  await createWarningIfNeeded({
    firmId,
    warningType: "storage_limit",
    usageValue: storageMbUsed,
    limitValue: limits.storageMbLimit,
  });

  const allowedByStatus = billingStatusAllowsAccess(
    billingStatus,
    gracePeriodEndsAt
  );

  let reason: string | null = null;

  if (!subscription) reason = "no_subscription";
  else if (!allowedByStatus) reason = `billing_status_${billingStatus}`;
  else if (
    !subscription?.soft_limit_mode &&
    clients > limits.clientLimit
  ) {
    reason = "client_limit_exceeded";
  } else if (
    !subscription?.soft_limit_mode &&
    staff > limits.staffLimit
  ) {
    reason = "staff_limit_exceeded";
  } else if (
    !subscription?.soft_limit_mode &&
    monthlySubmissions > limits.monthlySubmissionLimit
  ) {
    reason = "monthly_submission_limit_exceeded";
  } else if (
    !subscription?.soft_limit_mode &&
    storageMbUsed > limits.storageMbLimit
  ) {
    reason = "storage_limit_exceeded";
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
        storageMbUsed,
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
      storageMbUsed,
    },
    features: {
      ...defaultPlan.features,
      ...(planRow?.features || {}),
    },
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

export async function assertClientCreationAllowed(firmId: string) {
  const access = await assertFirmBillingAccess(firmId);

  if (access.usage.clients >= access.limits.clientLimit) {
    throw new Error("Client limit reached for current subscription");
  }

  return access;
}

export async function assertStaffInviteAllowed(firmId: string) {
  const access = await assertFirmBillingAccess(firmId);

  if (access.usage.staff >= access.limits.staffLimit) {
    throw new Error("Staff limit reached for current subscription");
  }

  return access;
}

export async function assertSubmissionAllowed(firmId: string) {
  const access = await assertFirmBillingAccess(firmId);

  if (
    access.usage.monthlySubmissions >=
    access.limits.monthlySubmissionLimit
  ) {
    throw new Error("Monthly submission quota reached");
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
  const billingMonth = currentBillingMonth();

  const access = await getFirmBillingAccess(params.firmId);

  let exceedsLimit = false;

  if (
    params.eventType === "hmrc_submission" &&
    access.usage.monthlySubmissions >=
      access.limits.monthlySubmissionLimit
  ) {
    exceedsLimit = true;
  }

  await supabaseAdmin.from("billing_usage_events").insert({
    firm_id: params.firmId,
    event_type: params.eventType,
    quantity: params.quantity || 1,
    resource_id: params.resourceId || null,
    billing_month: billingMonth,
    usage_category: params.eventType,
    exceeds_limit: exceedsLimit,
    metadata: params.metadata || {},
  });
}
