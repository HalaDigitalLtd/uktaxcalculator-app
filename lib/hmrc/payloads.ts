export interface QuarterTotals {
  income: number;
  expenses: number;
  netProfit: number;
}

function money(value: any) {
  const n = Number(value || 0);
  return Number(n.toFixed(2));
}

/**
 * Legacy/self-employment period summary payload.
 * Used for non-cumulative period endpoints only.
 */
export function buildSelfEmploymentPayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return {
    periodDates: {
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    },
    periodIncome: {
      turnover: money(totals.income),
      other: 0,
      taxTakenOffTradingIncome: 0,
    },
    periodExpenses: {
      consolidatedExpenses: money(totals.expenses),
    },
  };
}

/**
 * HMRC Self Employment cumulative period summary payload.
 * Used for:
 * /individuals/business/self-employment/{nino}/{businessId}/cumulative/{taxYear}
 */
export function buildSelfEmploymentCumulativePayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return {
    fromDate: periodStart,
    toDate: periodEnd,
    selfEmployment: {
      income: {
        turnover: money(totals.income),
        other: 0,
        taxTakenOffTradingIncome: 0,
      },
      expenses: {
        consolidatedExpenses: money(totals.expenses),
      },
    },
  };
}

export function buildUKPropertyPayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return {
    fromDate: periodStart,
    toDate: periodEnd,
    ukNonFhlProperty: {
      income: {
        periodAmount: money(totals.income),
        premiumsOfLeaseGrant: 0,
        reversePremiums: 0,
        taxDeducted: 0,
        otherIncome: 0,
      },
      expenses: {
        consolidatedExpenses: money(totals.expenses),
      },
    },
  };
}

export function buildUKPropertyCumulativePayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return buildUKPropertyPayload(totals, periodStart, periodEnd);
}

export function buildForeignPropertyPayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return {
    fromDate: periodStart,
    toDate: periodEnd,
    foreignFhlEea: {
      income: {
        periodAmount: money(totals.income),
      },
      expenses: {
        consolidatedExpenses: money(totals.expenses),
      },
    },
  };
}

export function buildForeignPropertyCumulativePayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return buildForeignPropertyPayload(totals, periodStart, periodEnd);
}