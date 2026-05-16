import { supabaseAdmin } from "./supabaseAdmin";

type AnyRow = Record<string, any>;

export type OperationalDashboardMetric = {
  label: string;
  value: number | string;
  tone: "green" | "amber" | "red" | "blue" | "slate";
  helper: string;
};

export type OperationalDashboardItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  href?: string | null;
  createdAt?: string | null;
};

export type OperationalDashboardResponse = {
  success: boolean;
  generatedAt: string;
  firmId: string;
  metrics: OperationalDashboardMetric[];
  queues: {
    failedSubmissions: OperationalDashboardItem[];
    partnerApprovals: OperationalDashboardItem[];
    overdueObligations: OperationalDashboardItem[];
    hmrcSyncWarnings: OperationalDashboardItem[];
    auditAlerts: OperationalDashboardItem[];
  };
  activity: OperationalDashboardItem[];
  warnings: string[];
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 5);
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeText(value: any, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getClientName(client: AnyRow) {
  return safeText(
    client.name ||
      client.client_name ||
      client.full_name ||
      client.display_name ||
      [client.first_name, client.last_name].filter(Boolean).join(" "),
    "Client"
  );
}

function makeItem(
  row: AnyRow,
  options: {
    title: string;
    description: string;
    status: string;
    href?: string | null;
    createdAt?: string | null;
  }
): OperationalDashboardItem {
  return {
    id: safeText(
      row.id ||
        row.client_id ||
        row.quarter_id ||
        row.tax_year_id ||
        `${options.title}-${options.createdAt || Date.now()}`
    ),
    title: options.title,
    description: options.description,
    status: options.status,
    href: options.href || null,
    createdAt: options.createdAt || row.created_at || row.updated_at || null,
  };
}

async function safeQuery<T>(
  label: string,
  warnings: string[],
  runner: () => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  try {
    const { data, error } = await runner();

    if (error) {
      warnings.push(`${label}: ${error.message || "Unable to read data"}`);
      return [];
    }

    return asArray(data);
  } catch (error: any) {
    warnings.push(`${label}: ${error?.message || "Unable to read data"}`);
    return [];
  }
}

export async function getOperationalDashboard(
  firmId: string
): Promise<OperationalDashboardResponse> {
  const warnings: string[] = [];
  const today = todayIsoDate();

  const clients = await safeQuery<AnyRow>("clients", warnings, () =>
    supabaseAdmin
      .from("clients")
      .select("*")
      .eq("firm_id", firmId)
      .order("created_at", { ascending: false })
      .limit(500)
  );

  const clientIds = clients.map((client) => client.id).filter(Boolean);

  const taxYears = clientIds.length
    ? await safeQuery<AnyRow>("tax_years", warnings, () =>
        supabaseAdmin
          .from("tax_years")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(1000)
      )
    : [];

  const taxYearIds = taxYears.map((year) => year.id).filter(Boolean);

  const quarters = taxYearIds.length
    ? await safeQuery<AnyRow>("quarters", warnings, () =>
        supabaseAdmin
          .from("quarters")
          .select("*")
          .in("tax_year_id", taxYearIds)
          .order("created_at", { ascending: false })
          .limit(1500)
      )
    : [];

  const obligations = clientIds.length
    ? await safeQuery<AnyRow>("obligations", warnings, () =>
        supabaseAdmin
          .from("obligations")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(1500)
      )
    : [];

  const submissionLogs = clientIds.length
    ? await safeQuery<AnyRow>("hmrc_submission_logs", warnings, () =>
        supabaseAdmin
          .from("hmrc_submission_logs")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(300)
      )
    : [];

  const snapshots = clientIds.length
    ? await safeQuery<AnyRow>("hmrc_submission_snapshots", warnings, () =>
        supabaseAdmin
          .from("hmrc_submission_snapshots")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(200)
      )
    : [];

  const amendments = taxYearIds.length
    ? await safeQuery<AnyRow>("tax_year_amendments", warnings, () =>
        supabaseAdmin
          .from("tax_year_amendments")
          .select("*")
          .in("tax_year_id", taxYearIds)
          .order("created_at", { ascending: false })
          .limit(200)
      )
    : [];

  const finalDeclarations = taxYearIds.length
    ? await safeQuery<AnyRow>("tax_year_final_declarations", warnings, () =>
        supabaseAdmin
          .from("tax_year_final_declarations")
          .select("*")
          .in("tax_year_id", taxYearIds)
          .order("created_at", { ascending: false })
          .limit(200)
      )
    : [];

  const failedLogs = submissionLogs.filter((log) => {
    const status = safeText(log.status, "").toLowerCase();
    const statusCode = Number(log.status_code || 0);
    return status.includes("fail") || status.includes("error") || statusCode >= 400;
  });

  const partnerApprovals = [
    ...finalDeclarations.filter((row) =>
      ["submitted_for_review", "in_review", "ready_for_approval", "prepared"].includes(
        safeText(row.status || row.workflow_status, "").toLowerCase()
      )
    ),
    ...amendments.filter((row) =>
      ["submitted_for_review", "in_review", "ready_for_approval", "prepared"].includes(
        safeText(row.status || row.workflow_status, "").toLowerCase()
      )
    ),
  ];

  const overdueObligations = obligations.filter((obligation) => {
    const dueDate = safeText(
      obligation.due_date ||
        obligation.obligation_due_date ||
        obligation.period_due_date ||
        obligation.period_end_date ||
        obligation.end_date,
      ""
    );

    const status = safeText(
      obligation.status || obligation.obligation_status || obligation.workflow_status,
      ""
    ).toLowerCase();

    if (!dueDate) return false;
    if (dueDate >= today) return false;

    return !["fulfilled", "submitted", "accepted", "complete", "completed"].includes(status);
  });

  const hmrcSyncWarnings = clients.filter((client) => {
    const updatedAt = client.hmrc_last_synced_at || client.last_hmrc_sync_at || client.updated_at || client.created_at;

    if (!updatedAt) return true;

    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const days = ageMs / 86400000;

    return days > 30;
  });

  const auditAlerts = [
    ...quarters.filter((quarter) => {
      const status = safeText(quarter.status || quarter.workflow_status, "").toLowerCase();
      return ["submitted", "accepted", "finalised", "finalized"].includes(status) && !quarter.locked_at;
    }),
    ...snapshots.filter((snapshot) => !snapshot.hmrc_correlation_id && !snapshot.hmrc_submission_id),
  ];

  const failedSubmissionItems = failedLogs.slice(0, 3).map((log) =>
    makeItem(log, {
      title: `${safeText(log.business_type || log.submission_type, "HMRC")} submission issue`,
      description: safeText(
        log.error_message || log.error_code || log.hmrc_endpoint,
        "Submission failed or needs review."
      ),
      status: safeText(log.status_code || log.status, "Failed"),
      href: log.client_id ? `/dashboard/clients/${log.client_id}` : null,
      createdAt: log.created_at,
    })
  );

  const partnerApprovalItems = partnerApprovals.slice(0, 3).map((row) =>
    makeItem(row, {
      title: "Partner approval required",
      description: `Workflow status: ${safeText(row.status || row.workflow_status, "Pending review")}`,
      status: safeText(row.status || row.workflow_status, "Pending"),
      href: "/dashboard/clients",
      createdAt: row.updated_at || row.created_at,
    })
  );

  const overdueObligationItems = overdueObligations.slice(0, 3).map((row) =>
    makeItem(row, {
      title: `${safeText(row.business_type || row.type_of_business || row.source_type, "MTD ITSA")} obligation overdue`,
      description: `Period ${safeText(row.period_start_date || row.start_date)} to ${safeText(
        row.period_end_date || row.end_date
      )}. Due ${safeText(row.due_date || row.obligation_due_date || row.period_due_date)}.`,
      status: safeText(row.status || row.obligation_status || row.workflow_status, "Open"),
      href: row.client_id ? `/dashboard/clients/${row.client_id}` : null,
      createdAt: row.updated_at || row.created_at,
    })
  );

  const hmrcSyncWarningItems = hmrcSyncWarnings.slice(0, 3).map((client) =>
    makeItem(client, {
      title: getClientName(client),
      description: "Client may need HMRC profile/obligation sync review.",
      status: "Sync review",
      href: `/dashboard/clients/${client.id}`,
      createdAt: client.updated_at || client.created_at,
    })
  );

  const auditAlertItems = auditAlerts.slice(0, 3).map((row) =>
    makeItem(row, {
      title: row.submission_type ? "Evidence snapshot warning" : "Workflow lock warning",
      description: row.submission_type
        ? "Snapshot exists without visible HMRC correlation/submission evidence."
        : "Submitted or accepted workflow appears unlocked.",
      status: row.submission_type || row.status || row.workflow_status || "Audit review",
      href: row.client_id ? `/dashboard/clients/${row.client_id}` : null,
      createdAt: row.updated_at || row.created_at || row.submitted_at,
    })
  );

  const activity = [
    ...submissionLogs.slice(0, 6).map((log) =>
      makeItem(log, {
        title: `${safeText(log.business_type || log.submission_type, "HMRC")} submission activity`,
        description: safeText(
          log.error_message || log.hmrc_endpoint || log.correlation_id,
          "Submission log recorded."
        ),
        status: safeText(log.status_code || log.status, "Logged"),
        href: log.client_id ? `/dashboard/clients/${log.client_id}` : null,
        createdAt: log.created_at,
      })
    ),
    ...snapshots.slice(0, 6).map((snapshot) =>
      makeItem(snapshot, {
        title: `${safeText(snapshot.submission_type, "Submission")} evidence snapshot`,
        description: `Environment: ${safeText(snapshot.environment, "unknown")}`,
        status: snapshot.hmrc_submission_id ? "Evidence stored" : "Snapshot stored",
        href: snapshot.client_id ? `/dashboard/clients/${snapshot.client_id}` : null,
        createdAt: snapshot.submitted_at || snapshot.created_at,
      })
    ),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    firmId,
    metrics: [
      {
        label: "Clients",
        value: clients.length,
        tone: "blue",
        helper: "Active firm client records visible to this workspace.",
      },
      {
        label: "Overdue obligations",
        value: overdueObligations.length,
        tone: overdueObligations.length ? "red" : "green",
        helper: "Open HMRC obligations past due date.",
      },
      {
        label: "Failed submissions",
        value: failedLogs.length,
        tone: failedLogs.length ? "red" : "green",
        helper: "HMRC submission logs requiring operational review.",
      },
      {
        label: "Approval queue",
        value: partnerApprovals.length,
        tone: partnerApprovals.length ? "amber" : "green",
        helper: "Final declaration or amendment workflows awaiting senior review.",
      },
      {
        label: "Evidence snapshots",
        value: snapshots.length,
        tone: "slate",
        helper: "Immutable HMRC evidence records captured.",
      },
      {
        label: "Audit alerts",
        value: auditAlerts.length,
        tone: auditAlerts.length ? "amber" : "green",
        helper: "Potential evidence, lock or workflow integrity checks.",
      },
    ],
    queues: {
      failedSubmissions: failedSubmissionItems,
      partnerApprovals: partnerApprovalItems,
      overdueObligations: overdueObligationItems,
      hmrcSyncWarnings: hmrcSyncWarningItems,
      auditAlerts: auditAlertItems,
    },
    activity,
    warnings,
  };
}

