type Row = Record<string, any>;

export type OperationalAlert = {
  key: string;
  severity: "info" | "warning" | "high" | "critical";
  title: string;
  description: string;
};

export function buildOperationalAlerts(evidencePack: Row) {
  const alerts: OperationalAlert[] = [];

  const riskLevel = evidencePack?.evidenceRisk?.riskLevel;
  const riskScore = Number(evidencePack?.evidenceRisk?.score || 0);

  if (riskLevel === "critical") {
    alerts.push({
      key: "critical_evidence_risk",
      severity: "critical",
      title: "Critical forensic evidence risk",
      description:
        "Snapshot contains critical evidence integrity gaps requiring immediate review.",
    });
  }

  if (riskScore >= 50 && riskScore < 75) {
    alerts.push({
      key: "high_evidence_risk",
      severity: "high",
      title: "High forensic evidence risk",
      description:
        "Submission evidence chain contains elevated forensic risk indicators.",
    });
  }

  if (
    evidencePack?.freezeValidation?.freezeStatus !== "frozen"
  ) {
    alerts.push({
      key: "snapshot_not_frozen",
      severity: "critical",
      title: "Snapshot freeze validation failed",
      description:
        "Immutable forensic freeze requirements are incomplete.",
    });
  }

  if (
    evidencePack?.digitalLinkValidation?.validationStatus !==
    "digital_link_validated"
  ) {
    alerts.push({
      key: "digital_link_review",
      severity: "warning",
      title: "Digital link review required",
      description:
        "Transaction and submission chain requires reconciliation review.",
    });
  }

  if (
    evidencePack?.tamperRisk?.riskLevel === "review_required"
  ) {
    alerts.push({
      key: "tamper_review",
      severity: "high",
      title: "Potential tamper-risk indicators detected",
      description:
        "Core integrity evidence is incomplete or inconsistent.",
    });
  }

  if (
    evidencePack?.amendmentDelta?.amendmentDetected &&
    !evidencePack?.amendmentDelta?.integrity?.hasAmendmentReason
  ) {
    alerts.push({
      key: "missing_amendment_reason",
      severity: "critical",
      title: "Amendment reason missing",
      description:
        "Amended submission detected without supporting justification.",
    });
  }

  if (
    evidencePack?.lineage?.isReplayed &&
    !evidencePack?.lineage?.replayOfSnapshotId
  ) {
    alerts.push({
      key: "invalid_replay_chain",
      severity: "critical",
      title: "Replay lineage invalid",
      description:
        "Replay activity detected without valid replay evidence chain.",
    });
  }

  if (
    evidencePack?.warnings?.length > 0
  ) {
    alerts.push({
      key: "evidence_warnings",
      severity: "warning",
      title: "Evidence completeness warnings detected",
      description:
        `${evidencePack.warnings.length} evidence validation warning(s) identified.`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalAlerts: alerts.length,
    alerts,
    hasCriticalAlerts: alerts.some(
      (a) => a.severity === "critical"
    ),
    hasHighAlerts: alerts.some(
      (a) => a.severity === "high"
    ),
  };
}