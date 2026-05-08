import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  RbacError,
  getAuthenticatedUserFromRequest,
  requireFirmPermission,
  rbacErrorResponse,
  type Permission,
} from "../../../../../lib/rbac";

export const dynamic = "force-dynamic";

type Action =
  | "initialise"
  | "refresh_checks"
  | "submit_for_review"
  | "approve"
  | "unapprove"
  | "lock"
  | "unlock"
  | "mark_submitting"
  | "mark_submitted"
  | "mark_failed";

function normaliseStatus(value: any) {
  return String(value || "").toLowerCase().trim();
}

function numberValue(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getQuarterIncome(q: any) {
  return numberValue(
    q?.income ??
      q?.income_total ??
      q?.total_income ??
      q?.turnover ??
      q?.sales ??
      q?.gross_income
  );
}

function getQuarterExpenses(q: any) {
  return numberValue(
    q?.expenses ??
      q?.expense_total ??
      q?.total_expenses ??
      q?.allowable_expenses
  );
}

function calculateAnnualTotals(quarters: any[]) {
  let annualIncome = 0;
  let annualExpenses = 0;

  for (const quarter of quarters || []) {
    annualIncome += getQuarterIncome(quarter);
    annualExpenses += getQuarterExpenses(quarter);
  }

  return {
    annualIncome,
    annualExpenses,
    annualProfit: annualIncome - annualExpenses,
  };
}

function buildReadinessChecks(input: {
  quarters: any[];
  annualIncome: number;
  annualExpenses: number;
  approved: boolean;
  locked: boolean;
  submitted: boolean;
}) {
  const quarters = input.quarters || [];

  const checks = {
    hasAnnualTotals: input.annualIncome > 0 || input.annualExpenses > 0,
    hasQuarterlyData: quarters.length > 0,
    allQuartersPrepared:
      quarters.length > 0 &&
      quarters.every((q: any) =>
        [
          "prepared",
          "submitted",
          "accepted",
          "finalised",
          "ready_to_submit",
        ].includes(normaliseStatus(q.status))
      ),
    accountantApproved: Boolean(input.approved),
    lockedForSubmission: Boolean(input.locked),
    notAlreadySubmitted: !input.submitted,
  };

  const readyToSubmit =
    checks.hasAnnualTotals &&
    checks.hasQuarterlyData &&
    checks.allQuartersPrepared &&
    checks.accountantApproved &&
    checks.lockedForSubmission &&
    checks.notAlreadySubmitted;

  return { checks, readyToSubmit };
}

function compatibilityWorkflow(row: any, readiness: any, totals: any) {
  if (!row) return null;

  return {
    ...row,
    annual_income: totals.annualIncome,
    annual_expenses: totals.annualExpenses,
    annual_profit: totals.annualProfit,
    accountant_approved: Boolean(row.approved),
    is_locked: Boolean(row.locked),
    ready_to_submit: readiness.readyToSubmit,
    readiness_checks: readiness.checks,
    hmrc_final_submission_id:
      row.hmrc_submission_id || row.hmrc_final_submission_id || null,
    final_submitted_at:
      row.hmrc_submitted_at || row.submitted_at || row.final_submitted_at || null,
    canonical_table: "tax_year_final_declarations",
    deprecated_legacy_table: "final_declaration_workflows",
  };
}

function permissionForAction(action: Action): Permission {
  if (action === "approve") return "workflow:approve";
  if (action === "unapprove") return "workflow:reject";
  if (action === "lock") return "workflow:lock";
  if (action === "unlock") return "workflow:unlock";
  if (action === "mark_submitting") return "hmrc:submit_final";
  if (action === "mark_submitted") return "hmrc:submit_final";
  if (action === "mark_failed") return "hmrc:submit_final";
  return "quarter:prepare";
}

async function loadClientAndTaxYear(clientId: string, taxYearId: string) {
  const { data: taxYear, error: taxYearError } = await supabaseAdmin
    .from("tax_years")
    .select("id, client_id")
    .eq("id", taxYearId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (taxYearError) throw new Error(taxYearError.message);

  if (!taxYear) {
    throw new RbacError("Tax year not found for this client.", 404);
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, firm_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);

  if (!client?.firm_id) {
    throw new RbacError("Client or firm not found.", 404);
  }

  return {
    client,
    taxYear,
    firmId: client.firm_id as string,
  };
}

async function loadQuarters(taxYearId: string) {
  const { data, error } = await supabaseAdmin
    .from("quarters")
    .select("*")
    .eq("tax_year_id", taxYearId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);

  return data || [];
}

async function loadCanonicalWorkflow(clientId: string, taxYearId: string) {
  const { data, error } = await supabaseAdmin
    .from("tax_year_final_declarations")
    .select("*")
    .eq("client_id", clientId)
    .eq("tax_year_id", taxYearId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || null;
}

async function saveCanonicalWorkflow(params: {
  existingWorkflow: any;
  firmId: string;
  clientId: string;
  taxYearId: string;
  payload: any;
}) {
  const basePayload = {
    firm_id: params.firmId,
    client_id: params.clientId,
    tax_year_id: params.taxYearId,
    updated_at: new Date().toISOString(),
    ...params.payload,
  };

  if (params.existingWorkflow?.id) {
    const { data, error } = await supabaseAdmin
      .from("tax_year_final_declarations")
      .update(basePayload)
      .eq("id", params.existingWorkflow.id)
      .eq("firm_id", params.firmId)
      .eq("client_id", params.clientId)
      .eq("tax_year_id", params.taxYearId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("tax_year_final_declarations")
    .insert(basePayload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function insertAudit(params: {
  workflowId: string;
  firmId: string;
  clientId: string;
  taxYearId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  metadata?: any;
  createdBy?: string | null;
}) {
  const metaPayload = params.metadata || {};

  const { error } = await supabaseAdmin
    .from("final_declaration_audit_trail")
    .insert({
      workflow_id: params.workflowId,
      firm_id: params.firmId,
      client_id: params.clientId,
      tax_year_id: params.taxYearId,
      action: params.action,
      from_status: params.fromStatus || null,
      to_status: params.toStatus || null,
      notes: params.notes || null,
      metadata: metaPayload,
      meta: metaPayload,
      created_by: params.createdBy || null,
    });

  if (error) {
    throw new Error(`Audit insert failed: ${error.message}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const clientId = searchParams.get("clientId");
    const taxYearId = searchParams.get("taxYearId");

    if (!clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or taxYearId." },
        { status: 400 }
      );
    }

    const { firmId } = await loadClientAndTaxYear(clientId, taxYearId);

    const role = await requireFirmPermission({
      userId: user.id,
      firmId,
      permission: "quarter:prepare",
    });

    const [workflow, quarters] = await Promise.all([
      loadCanonicalWorkflow(clientId, taxYearId),
      loadQuarters(taxYearId),
    ]);

    const totals = calculateAnnualTotals(quarters);

    const readiness = buildReadinessChecks({
      quarters,
      annualIncome: totals.annualIncome,
      annualExpenses: totals.annualExpenses,
      approved: Boolean(workflow?.approved),
      locked: Boolean(workflow?.locked),
      submitted: Boolean(workflow?.submitted || workflow?.status === "submitted"),
    });

    let auditTrail: any[] = [];

    if (workflow?.id) {
      const { data, error } = await supabaseAdmin
        .from("final_declaration_audit_trail")
        .select("*")
        .eq("workflow_id", workflow.id)
        .eq("firm_id", firmId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      auditTrail = data || [];
    }

    return NextResponse.json({
      success: true,
      workflow: compatibilityWorkflow(workflow, readiness, totals),
      canonicalWorkflow: workflow,
      auditTrail,
      readinessChecks: readiness.checks,
      readyToSubmit: readiness.readyToSubmit,
      userFirmRole: role,
      firmId,
    });
  } catch (err: any) {
    if (err instanceof RbacError) return rbacErrorResponse(err) as Response;

    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    const body = await req.json();

    const action = body.action as Action;
    const clientId = body.clientId;
    const taxYearId = body.taxYearId;

    if (!action || !clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const allowedActions: Action[] = [
      "initialise",
      "refresh_checks",
      "submit_for_review",
      "approve",
      "unapprove",
      "lock",
      "unlock",
      "mark_submitting",
      "mark_submitted",
      "mark_failed",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow action." },
        { status: 400 }
      );
    }

    const { firmId } = await loadClientAndTaxYear(clientId, taxYearId);

    const requiredPermission = permissionForAction(action);

    const role = await requireFirmPermission({
      userId: user.id,
      firmId,
      permission: requiredPermission,
    });

    const [existingWorkflow, quarters] = await Promise.all([
      loadCanonicalWorkflow(clientId, taxYearId),
      loadQuarters(taxYearId),
    ]);

    const totals = calculateAnnualTotals(quarters);

    const alreadySubmitted = Boolean(
      existingWorkflow?.submitted || existingWorkflow?.status === "submitted"
    );

    if (alreadySubmitted && !["refresh_checks"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Submitted final declaration is immutable. Use amendment workflow for post-submission corrections.",
        },
        { status: 400 }
      );
    }

    const currentApproved = Boolean(existingWorkflow?.approved);
    const currentLocked = Boolean(existingWorkflow?.locked);

    let nextStatus = existingWorkflow?.status || "not_initialised";
    let nextReviewState = existingWorkflow?.review_state || "not_started";
    let nextApproved = currentApproved;
    let nextLocked = currentLocked;
    let nextSubmitted = Boolean(existingWorkflow?.submitted);
    let lastError: string | null = null;

    if (action === "initialise" || action === "refresh_checks") {
      nextStatus =
        existingWorkflow?.status && existingWorkflow.status !== "not_initialised"
          ? existingWorkflow.status
          : "in_progress";
      nextReviewState =
        existingWorkflow?.review_state &&
        existingWorkflow.review_state !== "not_started"
          ? existingWorkflow.review_state
          : "draft";
    }

    if (action === "submit_for_review") {
      nextStatus = "in_review";
      nextReviewState = "submitted_for_accountant_review";
    }

    if (action === "approve") {
      nextStatus = "approved";
      nextReviewState = "accountant_approved";
      nextApproved = true;
    }

    if (action === "unapprove") {
      nextStatus = "in_review";
      nextReviewState = "approval_removed";
      nextApproved = false;
      nextLocked = false;
    }

    if (action === "lock") {
      if (!currentApproved && !nextApproved) {
        return NextResponse.json(
          {
            success: false,
            error: "Accountant approval is required before locking.",
          },
          { status: 400 }
        );
      }

      nextStatus = "locked";
      nextReviewState = "locked_for_submission";
      nextApproved = true;
      nextLocked = true;
    }

    if (action === "unlock") {
      nextStatus = nextApproved ? "approved" : "in_review";
      nextReviewState = "unlocked";
      nextLocked = false;
    }

    if (action === "mark_submitting") {
      if (!currentApproved) {
        return NextResponse.json(
          {
            success: false,
            error: "Final declaration is not accountant approved.",
          },
          { status: 400 }
        );
      }

      if (!currentLocked) {
        return NextResponse.json(
          {
            success: false,
            error: "Final declaration must be locked before submission.",
          },
          { status: 400 }
        );
      }

      nextStatus = "submitting";
      nextReviewState = "submission_in_progress";
      nextApproved = true;
      nextLocked = true;
    }

    if (action === "mark_submitted") {
      nextStatus = "submitted";
      nextReviewState = "submitted_to_hmrc";
      nextApproved = true;
      nextLocked = true;
      nextSubmitted = true;
    }

    if (action === "mark_failed") {
      nextStatus = "failed";
      nextReviewState = "submission_failed";
      lastError = body.error || "Final declaration submission failed.";
    }

    const readiness = buildReadinessChecks({
      quarters,
      annualIncome: totals.annualIncome,
      annualExpenses: totals.annualExpenses,
      approved: nextApproved,
      locked: nextLocked,
      submitted: nextSubmitted,
    });

    if (action === "submit_for_review") {
      if (
        !readiness.checks.hasAnnualTotals ||
        !readiness.checks.allQuartersPrepared
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Annual totals and all prepared quarters are required before review.",
            readinessChecks: readiness.checks,
          },
          { status: 400 }
        );
      }
    }

    if (action === "approve") {
      if (
        !readiness.checks.hasAnnualTotals ||
        !readiness.checks.allQuartersPrepared
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot approve until annual totals exist and all quarters are prepared.",
            readinessChecks: readiness.checks,
          },
          { status: 400 }
        );
      }
    }

    if (action === "lock") {
      if (
        !readiness.checks.hasAnnualTotals ||
        !readiness.checks.allQuartersPrepared
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot lock until annual totals exist and all quarters are prepared.",
            readinessChecks: readiness.checks,
          },
          { status: 400 }
        );
      }
    }

    const updatePayload: any = {
      status: nextStatus,
      review_state: nextReviewState,
      approved: nextApproved,
      locked: nextLocked,
      submitted: nextSubmitted,
      last_error: lastError,
    };

    if (action === "mark_submitted") {
      updatePayload.submitted_at = new Date().toISOString();
      updatePayload.hmrc_submitted_at = new Date().toISOString();
      updatePayload.hmrc_submission_id = body.hmrcFinalSubmissionId || null;
      updatePayload.hmrc_correlation_id = body.hmrcCorrelationId || null;
      updatePayload.hmrc_calculation_id = body.hmrcCalculationId || null;
      updatePayload.last_error = null;
    }

    const savedWorkflow = await saveCanonicalWorkflow({
      existingWorkflow,
      firmId,
      clientId,
      taxYearId,
      payload: updatePayload,
    });

    await insertAudit({
      workflowId: savedWorkflow.id,
      firmId,
      clientId,
      taxYearId,
      action,
      fromStatus: existingWorkflow?.status || null,
      toStatus: savedWorkflow.status,
      notes: body.notes || null,
      metadata: {
        annualIncome: totals.annualIncome,
        annualExpenses: totals.annualExpenses,
        annualProfit: totals.annualProfit,
        readyToSubmit: readiness.readyToSubmit,
        readinessChecks: readiness.checks,
        hmrcFinalSubmissionId: body.hmrcFinalSubmissionId || null,
        hmrcCorrelationId: body.hmrcCorrelationId || null,
        hmrcCalculationId: body.hmrcCalculationId || null,
        error: body.error || null,
        actorUserId: user.id,
        actorEmail: user.email || null,
        actorFirmRole: role,
        serverResolvedFirmId: firmId,
        canonicalTable: "tax_year_final_declarations",
        deprecatedLegacyTable: "final_declaration_workflows",
        createdFromRoute: "app/api/mtd/final-declaration/workflow/route.ts",
      },
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      workflow: compatibilityWorkflow(savedWorkflow, readiness, totals),
      canonicalWorkflow: savedWorkflow,
      readinessChecks: readiness.checks,
      readyToSubmit: readiness.readyToSubmit,
      userFirmRole: role,
      firmId,
    });
  } catch (err: any) {
    if (err instanceof RbacError) return rbacErrorResponse(err) as Response;

    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}