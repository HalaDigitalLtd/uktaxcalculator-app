type Row = Record<string, any>;

function numberValue(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function delta(original: number, amended: number) {
  return Number((amended - original).toFixed(2));
}

export function buildAmendmentDeltaEvidence(snapshot: Row) {
  const originalTotals = snapshot.original_totals || {};
  const adjustmentTotals = snapshot.adjustment_totals || {};
  const submittedTotals = snapshot.submitted_totals || {};

  const originalIncome = numberValue(
    originalTotals.income ?? snapshot.original_income_total
  );

  const originalExpenses = numberValue(
    originalTotals.expenses ?? snapshot.original_expense_total
  );

  const originalProfit = numberValue(
    originalTotals.profit ??
      originalIncome - originalExpenses
  );

  const adjustmentIncome = numberValue(
    adjustmentTotals.income
  );

  const adjustmentExpenses = numberValue(
    adjustmentTotals.expenses
  );

  const adjustmentProfit = numberValue(
    adjustmentTotals.profit ??
      adjustmentIncome - adjustmentExpenses
  );

  const finalIncome = numberValue(
    submittedTotals.income ?? snapshot.income_total
  );

  const finalExpenses = numberValue(
    submittedTotals.expenses ?? snapshot.expense_total
  );

  const finalProfit = numberValue(
    submittedTotals.profit ??
      finalIncome - finalExpenses
  );

  const incomeDelta = delta(originalIncome, finalIncome);
  const expenseDelta = delta(originalExpenses, finalExpenses);
  const profitDelta = delta(originalProfit, finalProfit);

  const amendmentDetected =
    incomeDelta !== 0 ||
    expenseDelta !== 0 ||
    profitDelta !== 0;

  return {
    amendmentDetected,

    amendmentMeta: {
      amendmentId: snapshot.amendment_id,
      amendmentReason: snapshot.amendment_reason,
      replayOfSnapshotId: snapshot.replay_of_snapshot_id,
      originalSnapshotId: snapshot.original_snapshot_id,
      previousSnapshotId: snapshot.previous_snapshot_id,
    },

    original: {
      income: originalIncome,
      expenses: originalExpenses,
      profit: originalProfit,
    },

    adjustments: {
      income: adjustmentIncome,
      expenses: adjustmentExpenses,
      profit: adjustmentProfit,
    },

    final: {
      income: finalIncome,
      expenses: finalExpenses,
      profit: finalProfit,
    },

    delta: {
      income: incomeDelta,
      expenses: expenseDelta,
      profit: profitDelta,
    },

    integrity: {
      finalMatchesOriginalPlusAdjustments:
        Number((originalIncome + adjustmentIncome).toFixed(2)) === finalIncome &&
        Number((originalExpenses + adjustmentExpenses).toFixed(2)) === finalExpenses,

      hasAmendmentReason:
        Boolean(snapshot.amendment_reason),

      hasOriginalSnapshotReference:
        Boolean(snapshot.original_snapshot_id),

      hasReplayReference:
        Boolean(snapshot.replay_of_snapshot_id),
    },

    enquiryNarrative: amendmentDetected
      ? {
          summary:
            "This submission contains amended totals compared with the original preserved submission evidence.",
          explanation:
            snapshot.amendment_reason ||
            "No amendment explanation recorded.",
        }
      : {
          summary:
            "No financial delta detected between original and submitted totals.",
          explanation:
            "Submission appears unchanged from original preserved evidence.",
        },
  };
}