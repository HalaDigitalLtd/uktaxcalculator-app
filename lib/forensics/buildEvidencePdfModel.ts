type Row = Record<string, any>;

export type EvidencePdfSection = {
  title: string;
  kind: "summary" | "table" | "json" | "narrative";
  content: any;
};

export function buildEvidencePdfModel(evidencePack: Row) {
  const sections: EvidencePdfSection[] = [
    {
      title: "Evidence Pack Certification",
      kind: "summary",
      content: {
        generatedAt: new Date().toISOString(),
        source: evidencePack.generatedFrom,
        snapshotId: evidencePack.snapshotId,
        status: "Read-only forensic evidence pack",
      },
    },
    {
      title: "Submission Identity",
      kind: "table",
      content: evidencePack.identity,
    },
    {
      title: "HMRC References",
      kind: "table",
      content: evidencePack.hmrcReferences,
    },
    {
      title: "Actor and RBAC Evidence",
      kind: "table",
      content: evidencePack.actor,
    },
    {
      title: "Financial Snapshot",
      kind: "table",
      content: evidencePack.financials,
    },
    {
      title: "Hash Chain Evidence",
      kind: "table",
      content: evidencePack.hashes,
    },
    {
      title: "Freeze Validation",
      kind: "table",
      content: evidencePack.freezeValidation,
    },
    {
      title: "Digital Link Validation",
      kind: "table",
      content: evidencePack.digitalLinkValidation,
    },
    {
      title: "Evidence Risk Score",
      kind: "table",
      content: evidencePack.evidenceRisk,
    },
    {
      title: "Operational Alerts",
      kind: "json",
      content: evidencePack.operationalAlerts,
    },
    {
      title: "Amendment Delta Evidence",
      kind: "json",
      content: evidencePack.amendmentDelta,
    },
    {
      title: "Amendment and Replay Lineage",
      kind: "table",
      content: evidencePack.lineage,
    },
    {
      title: "HMRC Payload",
      kind: "json",
      content: evidencePack.rawEvidence?.hmrcPayload,
    },
    {
      title: "HMRC Response",
      kind: "json",
      content: evidencePack.rawEvidence?.hmrcResponse,
    },
    {
      title: "Fraud Prevention Headers",
      kind: "json",
      content: evidencePack.rawEvidence?.fraudHeaders,
    },
    {
      title: "Tenant Context",
      kind: "json",
      content: evidencePack.rawEvidence?.tenantContext,
    },
    {
      title: "Audit Context",
      kind: "json",
      content: evidencePack.rawEvidence?.auditContext,
    },
    {
      title: "Digital Link Metadata",
      kind: "json",
      content: evidencePack.rawEvidence?.digitalLinkMetadata,
    },
  ];

  return {
    title: "HMRC Forensic Evidence Pack",
    generatedAt: new Date().toISOString(),
    snapshotId: evidencePack.snapshotId,
    clientId: evidencePack.rawSnapshotReference?.clientId,
    taxYearId: evidencePack.rawSnapshotReference?.taxYearId,
    submissionType: evidencePack.identity?.submissionType,
    environment: evidencePack.identity?.environment,
    riskScore: evidencePack.evidenceRisk?.score,
    riskLevel: evidencePack.evidenceRisk?.riskLevel,
    sections,
  };
}