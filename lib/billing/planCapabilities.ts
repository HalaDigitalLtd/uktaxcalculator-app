export type BillingPlanSlug = "starter" | "practice" | "scale" | "enterprise";

export type BillingFeature =
  | "hmrc_mtd_itsa"
  | "client_portal"
  | "csv_import"
  | "evidence_vault"
  | "amendments"
  | "team_members"
  | "billing_portal"
  | "final_declaration"
  | "priority_support";

export type PlanCapabilities = {
  slug: BillingPlanSlug;
  name: string;
  clientLimit: number;
  staffLimit: number;
  monthlySubmissionLimit: number;
  storageMbLimit: number;
  features: Record<BillingFeature, boolean>;
};

export const DEFAULT_PLAN_CAPABILITIES: Record<
  BillingPlanSlug,
  PlanCapabilities
> = {
  starter: {
    slug: "starter",
    name: "Starter",
    clientLimit: 25,
    staffLimit: 2,
    monthlySubmissionLimit: 50,
    storageMbLimit: 1024,
    features: {
      hmrc_mtd_itsa: true,
      client_portal: false,
      csv_import: true,
      evidence_vault: true,
      amendments: false,
      team_members: true,
      billing_portal: true,
      final_declaration: true,
      priority_support: false,
    },
  },
  practice: {
    slug: "practice",
    name: "Practice",
    clientLimit: 100,
    staffLimit: 8,
    monthlySubmissionLimit: 250,
    storageMbLimit: 10240,
    features: {
      hmrc_mtd_itsa: true,
      client_portal: true,
      csv_import: true,
      evidence_vault: true,
      amendments: true,
      team_members: true,
      billing_portal: true,
      final_declaration: true,
      priority_support: false,
    },
  },
  scale: {
    slug: "scale",
    name: "Scale",
    clientLimit: 250,
    staffLimit: 25,
    monthlySubmissionLimit: 1000,
    storageMbLimit: 51200,
    features: {
      hmrc_mtd_itsa: true,
      client_portal: true,
      csv_import: true,
      evidence_vault: true,
      amendments: true,
      team_members: true,
      billing_portal: true,
      final_declaration: true,
      priority_support: true,
    },
  },
  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    clientLimit: 999999,
    staffLimit: 999999,
    monthlySubmissionLimit: 999999,
    storageMbLimit: 999999,
    features: {
      hmrc_mtd_itsa: true,
      client_portal: true,
      csv_import: true,
      evidence_vault: true,
      amendments: true,
      team_members: true,
      billing_portal: true,
      final_declaration: true,
      priority_support: true,
    },
  },
};

export function normalisePlanSlug(
  value: string | null | undefined
): BillingPlanSlug {
  const slug = String(value || "").toLowerCase();

  if (
    slug === "starter" ||
    slug === "practice" ||
    slug === "scale" ||
    slug === "enterprise"
  ) {
    return slug;
  }

  return "starter";
}
