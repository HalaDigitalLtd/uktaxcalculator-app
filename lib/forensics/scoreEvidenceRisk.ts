type Row = Record<string, any>;

type RiskItem = {
  key: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  points: number;
};

function hasValue(value: any) {
  return value !== undefined && value !== null && value !== "";
}

function countItems(value: any) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

export function scoreEvidenceRisk(snapshot: Row) {
  const risks: RiskItem[] = [];

  const addRisk = (
    key: string,
    label: string,
    severity: RiskItem["severity"],
    points: number
  ) => {
    risks.push({ key, label, severity, points });
  };

  if (!hasValue(snapshot.idempotency_key)) {
    addRisk("missing_idempotency_key", "Missing idempotency key", "critical", 25);
  }

  if (!hasValue(snapshot.payload_hash)) {
    addRisk("missing_payload_hash", "Missing payload hash", "critical", 25);
  }

  if (!hasValue(snapshot.ledger_hash)) {
    addRisk("missing_ledger_hash", "Missing ledger hash", "high", 15);
  }

  if (!hasValue(snapshot.totals_hash)) {
    addRisk("missing_totals_hash", "Missing totals hash", "high", 15);
  }

  if (!hasValue(snapshot.submission_hash)) {
    addRisk("missing_submission_hash", "Missing submission hash", "medium", 8);
  }

  if (!hasValue(snapshot.submitted_at)) {
    addRisk("missing_submitted_at", "Missing submitted timestamp", "high", 15);
  }

  if (!hasValue(snapshot.submitted_by) && !hasValue(snapshot.submitted_by_email)) {
    addRisk("missing_actor", "Missing submission actor evidence", "high", 15);
  }

  if (!hasValue(snapshot.submitted_by_role)) {
    addRisk("missing_actor_role", "Missing submitted actor role", "high", 15);
  }

  if (countItems(snapshot.fraud_headers) === 0) {
    addRisk("missing_fraud_headers", "Missing fraud prevention headers", "critical", 25);
  }

  if (countItems(snapshot.audit_context) === 0) {
    addRisk("missing_audit_context", "Missing audit context", "high", 15);
  }

  if (countItems(snapshot.tenant_context) === 0) {
    addRisk("missing_tenant_context", "Missing tenant context", "high", 15);
  }

  if (countItems(snapshot.hmrc_payload) === 0) {
    addRisk("missing_hmrc_payload", "Missing HMRC payload", "critical", 30);
  }

  if (countItems(snapshot.hmrc_response) === 0) {
    addRisk("missing_hmrc_response", "Missing HMRC response", "critical", 30);
  }

  if (countItems(snapshot.transaction_snapshot) === 0) {
    addRisk("missing_transaction_snapshot", "Missing transaction snapshot", "medium", 10);
  }

  if (countItems(snapshot.batch_snapshot) === 0) {
    addRisk("missing_batch_snapshot", "Missing CSV/import batch snapshot", "medium", 10);
  }

  if (countItems(snapshot.digital_link_metadata) === 0) {
    addRisk("missing_digital_link_metadata", "Missing digital link metadata", "medium", 10);
  }

  if (snapshot.is_replayed && !hasValue(snapshot.replay_of_snapshot_id)) {
    addRisk("invalid_replay_lineage", "Replay marked without original replay snapshot ID", "critical", 30);
  }

  if (snapshot.submission_type === "amendment" && !hasValue(snapshot.amendment_id)) {
    addRisk("missing_amendment_id", "Amendment submission missing amendment record ID", "critical", 30);
  }

  if (snapshot.submission_type === "amendment" && !hasValue(snapshot.amendment_reason)) {
    addRisk("missing_amendment_reason", "Amendment reason is missing", "high", 15);
  }

  const rawScore = risks.reduce((sum, risk) => sum + risk.points, 0);
  const score = Math.min(rawScore, 100);

  const riskLevel =
    score >= 75
      ? "critical"
      : score >= 45
        ? "high"
        : score >= 20
          ? "medium"
          : score > 0
            ? "low"
            : "clean";

  return {
    score,
    riskLevel,
    risks,
    riskCount: risks.length,
    checkedAt: new Date().toISOString(),
  };
}