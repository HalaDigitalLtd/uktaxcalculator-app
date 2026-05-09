type Row = Record<string, any>;

function countItems(value: any) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function numberValue(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function validateDigitalLinkEvidence(snapshot: Row) {
  const transactionSnapshot = Array.isArray(snapshot.transaction_snapshot)
    ? snapshot.transaction_snapshot
    : [];

  const batchSnapshot = Array.isArray(snapshot.batch_snapshot)
    ? snapshot.batch_snapshot
    : [];

  const sourceTotals =
    snapshot.source_totals_snapshot &&
    typeof snapshot.source_totals_snapshot === "object"
      ? snapshot.source_totals_snapshot
      : {};

  const checks = [
    {
      key: "transaction_snapshot",
      label: "Transaction snapshot exists",
      ok: transactionSnapshot.length > 0,
    },
    {
      key: "source_totals_snapshot",
      label: "Source totals snapshot exists",
      ok: countItems(sourceTotals) > 0,
    },
    {
      key: "batch_snapshot",
      label: "CSV/import batch snapshot exists",
      ok: batchSnapshot.length > 0,
    },
    {
      key: "submitted_totals",
      label: "Submitted totals preserved",
      ok: countItems(snapshot.submitted_totals) > 0,
    },
    {
      key: "hmrc_payload",
      label: "HMRC payload preserved",
      ok: countItems(snapshot.hmrc_payload) > 0,
    },
  ];

  const transactionIncome = transactionSnapshot.reduce(
    (sum: number, row: any) =>
      sum + Math.max(numberValue(row.amount || row.income || row.credit), 0),
    0
  );

  const transactionExpenses = transactionSnapshot.reduce(
    (sum: number, row: any) =>
      sum + Math.max(numberValue(row.expense || row.debit), 0),
    0
  );

  const submittedIncome = numberValue(
    snapshot.submitted_totals?.income ?? snapshot.income_total
  );

  const submittedExpenses = numberValue(
    snapshot.submitted_totals?.expenses ?? snapshot.expense_total
  );

  const tolerance = 0.01;

  const reconciliation = {
    transactionIncome,
    transactionExpenses,
    submittedIncome,
    submittedExpenses,
    incomeDifference: Number((transactionIncome - submittedIncome).toFixed(2)),
    expenseDifference: Number((transactionExpenses - submittedExpenses).toFixed(2)),
    incomeMatches:
      transactionSnapshot.length === 0
        ? false
        : Math.abs(transactionIncome - submittedIncome) <= tolerance,
    expensesMatch:
      transactionSnapshot.length === 0
        ? false
        : Math.abs(transactionExpenses - submittedExpenses) <= tolerance,
  };

  const warnings = checks.filter((check) => !check.ok);

  if (transactionSnapshot.length > 0 && !reconciliation.incomeMatches) {
    warnings.push({
      key: "income_reconciliation",
      label: "Transaction income does not reconcile to submitted income",
      ok: false,
    });
  }

  if (transactionSnapshot.length > 0 && !reconciliation.expensesMatch) {
    warnings.push({
      key: "expense_reconciliation",
      label: "Transaction expenses do not reconcile to submitted expenses",
      ok: false,
    });
  }

  return {
    validationStatus:
      warnings.length === 0
        ? "digital_link_validated"
        : "digital_link_review_required",
    checkedAt: new Date().toISOString(),
    checks,
    warnings,
    reconciliation,
    evidenceCounts: {
      transactions: transactionSnapshot.length,
      batches: batchSnapshot.length,
      sourceTotals: countItems(sourceTotals),
      digitalLinkMetadata: countItems(snapshot.digital_link_metadata),
    },
  };
}