import { supabaseAdmin } from "./supabaseAdmin";

export function money(value: any) {
  const n = Number(value || 0);
  return Number(n.toFixed(2));
}

export function normaliseLedgerType(row: any) {
  return String(row?.entry_type || row?.transaction_type || "")
    .toLowerCase()
    .trim();
}

export function isActiveLedgerRow(row: any) {
  return row?.is_deleted !== true;
}

export function calculateLedgerTotals(rows: any[]) {
  let income = 0;
  let expenses = 0;

  rows.filter(isActiveLedgerRow).forEach((row) => {
    const amount = Math.abs(Number(row.amount || 0));
    const type = normaliseLedgerType(row);

    if (type === "income") income += amount;
    if (type === "expense") expenses += amount;
  });

  return {
    income: money(income),
    expenses: money(expenses),
    profit: money(income - expenses),
    transactionCount: rows.filter(isActiveLedgerRow).length,
  };
}

export async function getQuarterLedgerSnapshot(input: {
  firmId: string;
  clientId: string;
  taxYearId: string;
  quarterId: string;
}) {
  const { data: transactions, error: txError } = await supabaseAdmin
    .from("quarter_transactions")
    .select("*")
    .eq("firm_id", input.firmId)
    .eq("client_id", input.clientId)
    .eq("tax_year_id", input.taxYearId)
    .eq("quarter_id", input.quarterId)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (txError) throw txError;

  const activeTransactions = (transactions || []).filter(isActiveLedgerRow);
  const totals = calculateLedgerTotals(transactions || []);

  const { data: sources, error: sourceError } = await supabaseAdmin
    .from("quarter_income_sources")
    .select("*")
    .eq("firm_id", input.firmId)
    .eq("client_id", input.clientId)
    .eq("tax_year_id", input.taxYearId)
    .eq("quarter_id", input.quarterId)
    .order("hmrc_source", { ascending: true });

  if (sourceError) throw sourceError;

  const { data: batches, error: batchError } = await supabaseAdmin
    .from("csv_import_batches")
    .select("*")
    .eq("firm_id", input.firmId)
    .eq("client_id", input.clientId)
    .eq("tax_year_id", input.taxYearId)
    .eq("quarter_id", input.quarterId)
    .order("created_at", { ascending: true });

  if (batchError) throw batchError;

  const sourceTotals = (sources || []).map((source: any) => {
    const rows = activeTransactions.filter(
      (tx: any) => String(tx.source_row_id) === String(source.id)
    );

    const sourceTotal = calculateLedgerTotals(rows);

    return {
      sourceRowId: source.id,
      obligationId: source.obligation_id || null,
      hmrcSource: source.hmrc_source || null,
      hmrcBusinessId: source.hmrc_business_id || null,
      periodStart: source.period_start || null,
      periodEnd: source.period_end || null,
      status: source.status || null,
      income: sourceTotal.income,
      expenses: sourceTotal.expenses,
      profit: sourceTotal.profit,
      transactionCount: sourceTotal.transactionCount,
    };
  });

  return {
    transactions: activeTransactions,
    allTransactionsIncludingDeleted: transactions || [],
    sources: sources || [],
    batches: batches || [],
    totals,
    sourceTotals,
  };
}

export async function getTaxYearLedgerSnapshot(input: {
  firmId: string;
  clientId: string;
  taxYearId: string;
}) {
  const { data: quarters, error: quarterError } = await supabaseAdmin
    .from("quarters")
    .select("*")
    .eq("firm_id", input.firmId)
    .eq("client_id", input.clientId)
    .eq("tax_year_id", input.taxYearId)
    .order("start_date", { ascending: true });

  if (quarterError) throw quarterError;

  const quarterSnapshots = [];

  for (const quarter of quarters || []) {
    const snapshot = await getQuarterLedgerSnapshot({
      firmId: input.firmId,
      clientId: input.clientId,
      taxYearId: input.taxYearId,
      quarterId: quarter.id,
    });

    quarterSnapshots.push({
      quarter,
      ...snapshot,
    });
  }

  const annualIncome = quarterSnapshots.reduce(
    (sum, q: any) => sum + Number(q.totals.income || 0),
    0
  );

  const annualExpenses = quarterSnapshots.reduce(
    (sum, q: any) => sum + Number(q.totals.expenses || 0),
    0
  );

  return {
    quarters: quarterSnapshots,
    totals: {
      income: money(annualIncome),
      expenses: money(annualExpenses),
      profit: money(annualIncome - annualExpenses),
      transactionCount: quarterSnapshots.reduce(
        (sum, q: any) => sum + Number(q.totals.transactionCount || 0),
        0
      ),
    },
  };
}