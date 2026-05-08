import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

function buildReadinessChecks(input: any) {
  const checks = {
    hasAnnualTotals:
      Number(input.annualIncome || 0) >= 0 &&
      Number(input.annualExpenses || 0) >= 0,

    hasQuarterlyData:
      Array.isArray(input.quarters) && input.quarters.length > 0,

    allQuartersPrepared:
      Array.isArray(input.quarters) &&
      input.quarters.length > 0 &&
      input.quarters.every((q: any) =>
        ["prepared", "submitted", "accepted", "finalised", "ready_to_submit"].includes(
          String(q.status || "").toLowerCase()
        )
      ),

    noFailedQuarterSubmissions:
      !Array.isArray(input.quarterSubmissionLogs) ||
      input.quarterSubmissionLogs.every((log: any) => log.status !== "failed"),

    accountantApproved: Boolean(input.accountantApproved),

    lockedForSubmission:
      input.isLocked === true,
  };

  const readyToSubmit =
    checks.hasAnnualTotals &&
    checks.hasQuarterlyData &&
    checks.allQuartersPrepared &&
    checks.noFailedQuarterSubmissions &&
    checks.accountantApproved &&
    checks.lockedForSubmission;

  return { checks, readyToSubmit };
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

  const { error } = await supabaseAdmin.from("final_declaration_audit_trail").insert({
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
    console.error("Final declaration audit insert failed:", error.message);
    throw new Error(`Audit insert failed: ${error.message}`);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const clientId = searchParams.get("clientId");
    const taxYearId = searchParams.get("taxYearId");

    if (!clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or taxYearId." },
        { status: 400 }
      );
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from("final_declaration_workflows")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    if (workflowError) {
      return NextResponse.json(
        { success: false, error: workflowError.message },
        { status: 500 }
      );
    }

    let auditTrail: any[] = [];

    if (workflow?.id) {
      const { data: auditData, error: auditError } = await supabaseAdmin
        .from("final_declaration_audit_trail")
        .select("*")
        .eq("workflow_id", workflow.id)
        .order("created_at", { ascending: false });

      if (auditError) {
        return NextResponse.json(
          { success: false, error: auditError.message },
          { status: 500 }
        );
      }

      auditTrail = auditData || [];
    }

    return NextResponse.json({
      success: true,
      workflow,
      auditTrail,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const action = body.action as Action;
    const firmId = body.firmId;
    const clientId = body.clientId;
    const taxYearId = body.taxYearId;
    const userId = body.userId || null;

    if (!action || !firmId || !clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: existingWorkflow } = await supabaseAdmin
      .from("final_declaration_workflows")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    const annualIncome = Number(
      body.annualIncome || existingWorkflow?.annual_income || 0
    );

    const annualExpenses = Number(
      body.annualExpenses || existingWorkflow?.annual_expenses || 0
    );

    const annualProfit = annualIncome - annualExpenses;

    const accountantApproved =
      action === "approve"
        ? true
        : action === "unapprove"
        ? false
        : Boolean(existingWorkflow?.accountant_approved);

    const isLocked =
      action === "lock"
        ? true
        : action === "unlock"
        ? false
        : Boolean(existingWorkflow?.is_locked);

    const readiness = buildReadinessChecks({
      ...body,
      annualIncome,
      annualExpenses,
      accountantApproved,
      isLocked,
    });

    const updatePayload: any = {
      firm_id: firmId,
      client_id: clientId,
      tax_year_id: taxYearId,
      annual_income: annualIncome,
      annual_expenses: annualExpenses,
      annual_profit: annualProfit,
      readiness_checks: readiness.checks,
      ready_to_submit: readiness.readyToSubmit,
      last_error: null,
    };

    if (action === "initialise" || action === "refresh_checks") {
      updatePayload.status = existingWorkflow?.status || "draft";
      updatePayload.review_state =
        existingWorkflow?.review_state || "not_started";
    }

    if (action === "submit_for_review") {
      updatePayload.status = "under_review";
      updatePayload.review_state = "awaiting_accountant_review";
    }

    if (action === "approve") {
      updatePayload.status = "approved";
      updatePayload.review_state = "accountant_approved";
      updatePayload.accountant_approved = true;
      updatePayload.approved_at = new Date().toISOString();
      updatePayload.approved_by = userId;
      updatePayload.ready_to_submit = readiness.readyToSubmit;
      updatePayload.readiness_checks = {
        ...readiness.checks,
        accountantApproved: true,
      };
    }

    if (action === "unapprove") {
      updatePayload.status = "under_review";
      updatePayload.review_state = "awaiting_accountant_review";
      updatePayload.accountant_approved = false;
      updatePayload.approved_at = null;
      updatePayload.approved_by = null;
      updatePayload.ready_to_submit = false;
    }

    if (action === "lock") {
      if (!existingWorkflow?.accountant_approved) {
        return NextResponse.json(
          { success: false, error: "Accountant approval is required before locking." },
          { status: 400 }
        );
      }

      updatePayload.is_locked = true;
      updatePayload.locked_at = new Date().toISOString();
      updatePayload.locked_by = userId;
      updatePayload.status = existingWorkflow?.status || "approved";
      updatePayload.ready_to_submit = true;
      updatePayload.readiness_checks = {
        ...readiness.checks,
        accountantApproved: true,
        lockedForSubmission: true,
      };
    }

    if (action === "unlock") {
      if (existingWorkflow?.status === "submitted") {
        return NextResponse.json(
          { success: false, error: "Submitted final declaration cannot be unlocked." },
          { status: 400 }
        );
      }

      updatePayload.is_locked = false;
      updatePayload.locked_at = null;
      updatePayload.locked_by = null;
      updatePayload.ready_to_submit = false;
    }

    if (action === "mark_submitting") {
      if (!existingWorkflow?.accountant_approved) {
        return NextResponse.json(
          {
            success: false,
            error: "Final declaration is not accountant approved.",
          },
          { status: 400 }
        );
      }

      updatePayload.status = "submitting";
      updatePayload.review_state = "submission_in_progress";
      updatePayload.ready_to_submit = false;
    }

    if (action === "mark_submitted") {
      updatePayload.status = "submitted";
      updatePayload.review_state = "finalised";
      updatePayload.hmrc_final_submission_id =
        body.hmrcFinalSubmissionId || null;
      updatePayload.final_submitted_at = new Date().toISOString();
      updatePayload.final_submitted_by = userId;
      updatePayload.is_locked = true;
      updatePayload.locked_at = new Date().toISOString();
      updatePayload.locked_by = userId;
      updatePayload.ready_to_submit = false;
    }

    if (action === "mark_failed") {
      updatePayload.status = "failed";
      updatePayload.review_state = "submission_failed";
      updatePayload.last_error =
        body.error || "Final declaration submission failed.";
      updatePayload.ready_to_submit = false;
    }

    const { data: workflow, error } = await supabaseAdmin
      .from("final_declaration_workflows")
      .upsert(updatePayload, {
        onConflict: "client_id,tax_year_id",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    await insertAudit({
      workflowId: workflow.id,
      firmId,
      clientId,
      taxYearId,
      action,
      fromStatus: existingWorkflow?.status || null,
      toStatus: workflow.status,
      notes: body.notes || null,
      metadata: {
        annualIncome,
        annualExpenses,
        annualProfit,
        readyToSubmit: workflow.ready_to_submit,
        readinessChecks: workflow.readiness_checks,
        hmrcFinalSubmissionId: body.hmrcFinalSubmissionId || null,
        error: body.error || null,
        createdFromRoute: "app/api/mtd/final-declaration/workflow/route.ts",
      },
      createdBy: userId,
    });

    return NextResponse.json({
      success: true,
      workflow,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}