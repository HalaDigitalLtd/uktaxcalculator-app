import { supabaseAdmin } from "./supabaseAdmin";
import {
  createIdempotencyKey,
  createSubmissionHashes,
  sha256,
  type SubmissionType,
} from "./hmrcSubmissionIntegrity";

type SnapshotInput = {
  firmId: string;
  clientId: string;
  taxYearId: string;
  quarterId?: string | null;
  amendmentId?: string | null;

  submissionType: SubmissionType;
  workflowStatus: string;
  sourceRoute: string;
  sourceTable?: string | null;
  sourceRecordId?: string | null;

  hmrcPayload: any;
  hmrcResponse: any;
  fraudHeaders?: any;
  oauthContext?: any;
  tenantContext?: any;
  auditContext?: any;

  originalTotals?: any;
  adjustmentTotals?: any;
  submittedTotals: any;

  ledgerSnapshot?: any;
  transactionSnapshot?: any[];
  sourceTotalsSnapshot?: any;
  batchSnapshot?: any[];

  hmrcCorrelationId?: string | null;
  hmrcSubmissionId?: string | null;
  hmrcAmendmentId?: string | null;

  environment?: string;
  submissionAttempt?: number;

  submittedBy?: string | null;
  submittedByEmail?: string | null;
  submittedByRole?: string | null;

  isFinal?: boolean;
  isReplayed?: boolean;
  replayOfSnapshotId?: string | null;
  originalSnapshotId?: string | null;
  previousSnapshotId?: string | null;
};

export async function createHmrcSubmissionSnapshot(input: SnapshotInput) {
  const hashes = createSubmissionHashes({
    hmrcPayload: input.hmrcPayload,
    ledger: input.ledgerSnapshot || input.transactionSnapshot || {},
    totals: input.submittedTotals,
  });

  const idempotencyKey = createIdempotencyKey({
    submissionType: input.submissionType,
    clientId: input.clientId,
    taxYearId: input.taxYearId,
    quarterId: input.quarterId || null,
    amendmentId: input.amendmentId || null,
    payloadHash: hashes.payloadHash,
  });

  const submissionHash = sha256({
    firmId: input.firmId,
    clientId: input.clientId,
    taxYearId: input.taxYearId,
    quarterId: input.quarterId || null,
    amendmentId: input.amendmentId || null,
    submissionType: input.submissionType,
    payloadHash: hashes.payloadHash,
    ledgerHash: hashes.ledgerHash,
    totalsHash: hashes.totalsHash,
    hmrcCorrelationId: input.hmrcCorrelationId || null,
    hmrcSubmissionId: input.hmrcSubmissionId || null,
  });

  const payload: any = {
    firm_id: input.firmId,
    client_id: input.clientId,
    tax_year_id: input.taxYearId,
    quarter_id: input.quarterId || null,
    amendment_id: input.amendmentId || null,

    submission_type: input.submissionType,
    workflow_status: input.workflowStatus,
    source_route: input.sourceRoute,
    source_table: input.sourceTable || null,
    source_record_id: input.sourceRecordId || null,

    idempotency_key: idempotencyKey,
    payload_hash: hashes.payloadHash,
    ledger_hash: hashes.ledgerHash,
    totals_hash: hashes.totalsHash,
    submission_hash: submissionHash,

    original_totals: input.originalTotals || {},
    adjustment_totals: input.adjustmentTotals || {},
    submitted_totals: input.submittedTotals || {},

    hmrc_payload: input.hmrcPayload || {},
    hmrc_response: input.hmrcResponse || {},

    hmrc_correlation_id: input.hmrcCorrelationId || null,
    hmrc_submission_id: input.hmrcSubmissionId || null,
    hmrc_amendment_id: input.hmrcAmendmentId || null,

    fraud_headers: input.fraudHeaders || {},
    oauth_context: input.oauthContext || {},
    tenant_context: input.tenantContext || {},
    audit_context: input.auditContext || {},

    transaction_snapshot: input.transactionSnapshot || [],
    source_totals_snapshot: input.sourceTotalsSnapshot || {},
    batch_snapshot: input.batchSnapshot || [],

    environment:
      input.environment || process.env.HMRC_ENVIRONMENT || "sandbox",
    submission_attempt: input.submissionAttempt || 1,

    submitted_by: input.submittedBy || null,
    submitted_by_email: input.submittedByEmail || null,
    submitted_by_role: input.submittedByRole || null,
    submitted_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),

    is_final: input.isFinal ?? true,
    is_replayed: input.isReplayed ?? false,
    replay_of_snapshot_id: input.replayOfSnapshotId || null,
    original_snapshot_id: input.originalSnapshotId || null,
    previous_snapshot_id: input.previousSnapshotId || null,
  };

  const { data, error } = await supabaseAdmin
    .from("hmrc_submission_snapshots")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("duplicate key")) {
      const { data: existing } = await supabaseAdmin
        .from("hmrc_submission_snapshots")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) return existing;
    }

    throw error;
  }

  return data;
}