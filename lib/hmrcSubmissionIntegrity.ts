import crypto from "crypto";

export type SubmissionType =
  | "quarterly_update"
  | "final_declaration"
  | "amendment"
  | "obligations_sync";

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

export function sha256(value: any): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createIdempotencyKey(input: {
  submissionType: SubmissionType;
  clientId: string;
  taxYearId?: string | null;
  quarterId?: string | null;
  amendmentId?: string | null;
  payloadHash: string;
}) {
  return sha256({
    submissionType: input.submissionType,
    clientId: input.clientId,
    taxYearId: input.taxYearId || null,
    quarterId: input.quarterId || null,
    amendmentId: input.amendmentId || null,
    payloadHash: input.payloadHash,
  });
}

export function createSubmissionHashes(input: {
  hmrcPayload: any;
  ledger?: any;
  totals?: any;
}) {
  return {
    payloadHash: sha256(input.hmrcPayload || {}),
    ledgerHash: sha256(input.ledger || {}),
    totalsHash: sha256(input.totals || {}),
  };
}