type Row = Record<string, any>;

function hasValue(value: any) {
  return value !== undefined && value !== null && value !== "";
}

function countItems(value: any) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

export function validateSnapshotFreeze(snapshot: Row) {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!hasValue(snapshot.id)) failures.push("Snapshot ID is missing.");
  if (!hasValue(snapshot.client_id)) failures.push("Client ID is missing.");
  if (!hasValue(snapshot.submission_type)) failures.push("Submission type is missing.");
  if (!hasValue(snapshot.workflow_status)) failures.push("Workflow status is missing.");
  if (!hasValue(snapshot.idempotency_key)) failures.push("Idempotency key is missing.");
  if (!hasValue(snapshot.payload_hash)) failures.push("Payload hash is missing.");
  if (!hasValue(snapshot.hmrc_payload)) failures.push("HMRC payload is missing.");
  if (!hasValue(snapshot.hmrc_response)) failures.push("HMRC response is missing.");
  if (!hasValue(snapshot.created_at)) failures.push("Created timestamp is missing.");

  if (!hasValue(snapshot.ledger_hash)) warnings.push("Ledger hash is missing.");
  if (!hasValue(snapshot.totals_hash)) warnings.push("Totals hash is missing.");
  if (!hasValue(snapshot.submission_hash)) warnings.push("Submission hash is missing.");
  if (!hasValue(snapshot.submitted_at)) warnings.push("Submitted timestamp is missing.");
  if (!hasValue(snapshot.submitted_by) && !hasValue(snapshot.submitted_by_email)) {
    warnings.push("Submission actor is missing.");
  }
  if (!hasValue(snapshot.submitted_by_role)) warnings.push("Submission actor role is missing.");
  if (countItems(snapshot.fraud_headers) === 0) warnings.push("Fraud prevention headers are missing.");
  if (countItems(snapshot.tenant_context) === 0) warnings.push("Tenant context is missing.");
  if (countItems(snapshot.audit_context) === 0) warnings.push("Audit context is missing.");

  const isFrozen =
    failures.length === 0 &&
    hasValue(snapshot.idempotency_key) &&
    hasValue(snapshot.payload_hash) &&
    hasValue(snapshot.created_at);

  return {
    isFrozen,
    freezeStatus: isFrozen ? "frozen" : "not_frozen",
    severity:
      failures.length > 0
        ? "critical"
        : warnings.length > 0
          ? "review_required"
          : "complete",
    failures,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}