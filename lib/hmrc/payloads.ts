export interface QuarterTotals {
  income: number;
  expenses: number;
  netProfit: number;
}

function money(value: any) {
  const n = Number(value || 0);
  return Number(n.toFixed(2));
}

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

export function buildForeignPropertyPayload(
  totals: QuarterTotals,
  periodStart: string,
  periodEnd: string
) {
  return {
    fromDate: periodStart,
    toDate: periodEnd,
    foreignProperty: [
      {
        countryCode: "AE",
        income: {
          rentIncome: money(totals.income),
          foreignTaxCreditRelief: false,
          premiumsOfLeaseGrant: 0,
          otherPropertyIncome: 0,
          foreignTaxPaidOrDeducted: 0,
          specialWithholdingTaxOrUkTaxPaid: 0,
        },
        expenses: {
          consolidatedExpenses: money(totals.expenses),
        },
      },
    ],
  };
}