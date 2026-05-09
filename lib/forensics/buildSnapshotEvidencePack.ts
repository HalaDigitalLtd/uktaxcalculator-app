import { validateSnapshotFreeze } from "./validateSnapshotFreeze";
type Row = Record<string, any>;

function countItems(value: any) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function bool(value: any) {
  return Boolean(value);
}

function hasMeaningfulValue(value: any) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== "";
}

export function buildSnapshotEvidencePack(snapshot: Row) {
  const checks = [
    { key: "payload_hash", label: "Payload hash preserved", ok: bool(snapshot.payload_hash) },
    { key: "ledger_hash", label: "Ledger hash preserved", ok: bool(snapshot.ledger_hash) },
    { key: "totals_hash", label: "Totals hash preserved", ok: bool(snapshot.totals_hash) },
    { key: "hmrc_payload", label: "HMRC payload preserved", ok: countItems(snapshot.hmrc_payload) > 0 },
    { key: "hmrc_response", label: "HMRC response preserved", ok: countItems(snapshot.hmrc_response) > 0 },
    { key: "fraud_headers", label: "Fraud headers preserved", ok: countItems(snapshot.fraud_headers) > 0 },
    { key: "oauth_context", label: "OAuth context preserved", ok: countItems(snapshot.oauth_context) > 0 },
    { key: "tenant_context", label: "Tenant context preserved", ok: countItems(snapshot.tenant_context) > 0 },
    { key: "audit_context", label: "Audit context preserved", ok: countItems(snapshot.audit_context) > 0 },
    { key: "submitted_by", label: "Submitted actor preserved", ok: bool(snapshot.submitted_by) || bool(snapshot.submitted_by_email) },
    { key: "submitted_by_role", label: "Submitted actor role preserved", ok: bool(snapshot.submitted_by_role) },
    { key: "submitted_at", label: "Submitted timestamp preserved", ok: bool(snapshot.submitted_at) },
    { key: "idempotency_key", label: "Idempotency key preserved", ok: bool(snapshot.idempotency_key) },
    { key: "digital_link_metadata", label: "Digital link metadata present", ok: countItems(snapshot.digital_link_metadata) > 0 },
    { key: "transaction_snapshot", label: "Transaction snapshot present", ok: countItems(snapshot.transaction_snapshot) > 0 },
    { key: "source_totals_snapshot", label: "Source totals snapshot present", ok: countItems(snapshot.source_totals_snapshot) > 0 },
    { key: "batch_snapshot", label: "Batch snapshot present", ok: countItems(snapshot.batch_snapshot) > 0 },
  ];

  const warnings = checks.filter((check) => !check.ok);
  const freezeValidation = validateSnapshotFreeze(snapshot);

  const freezeStatus = {
    isImmutableRecord: true,
    isReadOnlyEvidenceObject: true,
    hasPayloadHash: bool(snapshot.payload_hash),
    hasLedgerHash: bool(snapshot.ledger_hash),
    hasTotalsHash: bool(snapshot.totals_hash),
    hasSubmissionHash: bool(snapshot.submission_hash),
    hasSubmittedTimestamp: bool(snapshot.submitted_at),
    hasActorEvidence: bool(snapshot.submitted_by) || bool(snapshot.submitted_by_email),
    hasRoleEvidence: bool(snapshot.submitted_by_role),
    hasHmrcReference:
      bool(snapshot.hmrc_submission_id) ||
      bool(snapshot.hmrc_correlation_id) ||
      bool(snapshot.hmrc_amendment_id),
    warningCount: warnings.length,
    status:
      warnings.length === 0
        ? "forensic_complete"
        : warnings.length <= 3
          ? "review_required"
          : "evidence_gaps_detected",
  };

  const digitalLink = {
    transactionSnapshotCount: countItems(snapshot.transaction_snapshot),
    sourceTotalsCount: countItems(snapshot.source_totals_snapshot),
    batchSnapshotCount: countItems(snapshot.batch_snapshot),
    metadataKeys: snapshot.digital_link_metadata
      ? Object.keys(snapshot.digital_link_metadata)
      : [],
    hasTransactionSnapshot: countItems(snapshot.transaction_snapshot) > 0,
    hasSourceTotalsSnapshot: countItems(snapshot.source_totals_snapshot) > 0,
    hasBatchSnapshot: countItems(snapshot.batch_snapshot) > 0,
    hasDigitalLinkMetadata: countItems(snapshot.digital_link_metadata) > 0,
    validationStatus:
      countItems(snapshot.transaction_snapshot) > 0 &&
      countItems(snapshot.source_totals_snapshot) > 0 &&
      countItems(snapshot.batch_snapshot) > 0
        ? "digital_link_evidence_present"
        : "digital_link_review_required",
  };

  const tamperRisk = {
    riskLevel:
      bool(snapshot.payload_hash) &&
      bool(snapshot.ledger_hash) &&
      bool(snapshot.totals_hash) &&
      bool(snapshot.idempotency_key)
        ? "low"
        : "review_required",
    reasons: [
      !snapshot.payload_hash ? "Missing payload hash" : null,
      !snapshot.ledger_hash ? "Missing ledger hash" : null,
      !snapshot.totals_hash ? "Missing totals hash" : null,
      !snapshot.idempotency_key ? "Missing idempotency key" : null,
      !snapshot.submitted_at ? "Missing submitted timestamp" : null,
      !snapshot.submitted_by_role ? "Missing submitted actor role" : null,
    ].filter(Boolean),
  };

  return {
    snapshotId: snapshot.id,
    generatedFrom: "hmrc_submission_snapshots",
    generatedAt: new Date().toISOString(),

    freezeStatus,
    freezeValidation,
    digitalLink,
    tamperRisk,

    identity: {
      submissionType: snapshot.submission_type,
      workflowStatus: snapshot.workflow_status,
      environment: snapshot.environment,
      submissionAttempt: snapshot.submission_attempt,
      sourceRoute: snapshot.source_route,
      sourceTable: snapshot.source_table,
      sourceRecordId: snapshot.source_record_id,
    },

    hmrcReferences: {
      correlationId: snapshot.hmrc_correlation_id,
      submissionId: snapshot.hmrc_submission_id,
      amendmentId: snapshot.hmrc_amendment_id,
      idempotencyKey: snapshot.idempotency_key,
    },

    actor: {
      submittedBy: snapshot.submitted_by,
      submittedByEmail: snapshot.submitted_by_email,
      submittedByRole: snapshot.submitted_by_role,
      submittedAt: snapshot.submitted_at,
      lockedAt: snapshot.locked_at,
    },

    financials: {
      incomeTotal: snapshot.income_total,
      expenseTotal: snapshot.expense_total,
      profitTotal: snapshot.profit_total,
      transactionCount: snapshot.transaction_count,
      originalTotals: snapshot.original_totals,
      adjustmentTotals: snapshot.adjustment_totals,
      submittedTotals: snapshot.submitted_totals,
    },

    hashes: {
      payloadHash: snapshot.payload_hash,
      ledgerHash: snapshot.ledger_hash,
      totalsHash: snapshot.totals_hash,
      submissionHash: snapshot.submission_hash,
    },

    lineage: {
      amendmentId: snapshot.amendment_id,
      amendmentReason: snapshot.amendment_reason,
      originalSnapshotId: snapshot.original_snapshot_id,
      previousSnapshotId: snapshot.previous_snapshot_id,
      replayOfSnapshotId: snapshot.replay_of_snapshot_id,
      isFinal: snapshot.is_final,
      isReplayed: snapshot.is_replayed,
    },

    period: {
      periodStart: snapshot.period_start,
      periodEnd: snapshot.period_end,
    },

    checks,
    warnings,

    rawEvidence: {
      hmrcPayload: snapshot.hmrc_payload,
      hmrcResponse: snapshot.hmrc_response,
      fraudHeaders: snapshot.fraud_headers,
      oauthContext: snapshot.oauth_context,
      tenantContext: snapshot.tenant_context,
      auditContext: snapshot.audit_context,
      transactionSnapshot: snapshot.transaction_snapshot,
      sourceTotalsSnapshot: snapshot.source_totals_snapshot,
      batchSnapshot: snapshot.batch_snapshot,
      digitalLinkMetadata: snapshot.digital_link_metadata,
    },

    rawSnapshotReference: {
      id: snapshot.id,
      firmId: snapshot.firm_id,
      clientId: snapshot.client_id,
      taxYearId: snapshot.tax_year_id,
      quarterId: snapshot.quarter_id,
      amendmentId: snapshot.amendment_id,
      createdAt: snapshot.created_at,
      lockedAt: snapshot.locked_at,
      submittedAt: snapshot.submitted_at,
    },

    hasMeaningfulEvidence: {
      hmrcPayload: hasMeaningfulValue(snapshot.hmrc_payload),
      hmrcResponse: hasMeaningfulValue(snapshot.hmrc_response),
      fraudHeaders: hasMeaningfulValue(snapshot.fraud_headers),
      auditContext: hasMeaningfulValue(snapshot.audit_context),
      tenantContext: hasMeaningfulValue(snapshot.tenant_context),
      digitalLinkMetadata: hasMeaningfulValue(snapshot.digital_link_metadata),
    },
  };
}