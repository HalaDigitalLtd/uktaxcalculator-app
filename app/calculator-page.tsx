"use client";

import { useMemo, useState } from "react";

type TaxYear = "2024/25" | "2025/26" | "2026/27";
type StudentLoanKey = "none" | "plan1" | "plan2" | "plan4" | "plan5" | "pgl";

type Inputs = {
  taxYear: TaxYear;
  residency: "england" | "scotland";
  employmentIncome: number;
  payeTaxDeducted: number;
  selfEmploymentTurnover: number;
  selfEmploymentExpenses: number;
  rentalProfit: number;
  dividends: number;
  savingsInterest: number;
  pensionGross: number;
  giftAidGross: number;
  studentLoan: StudentLoanKey;
  paymentsOnAccountPaid: number;
};

const TAX_RULES = {
  "2024/25": {
    personalAllowance: 12570,
    paTaperStart: 100000,
    additionalThreshold: 125140,
    basicBand: 37700,
    dividendAllowance: 500,
    savingsStartingRateMax: 5000,
    psaBasic: 1000,
    psaHigher: 500,
    psaAdditional: 0,
    incomeTaxRates: { basic: 0.2, higher: 0.4, additional: 0.45 },
    dividendRates: { basic: 0.0875, higher: 0.3375, additional: 0.3935 },
    employeeNI: { primaryThreshold: 12570, upperEarningsLimit: 50270, mainRate: 0.08, additionalRate: 0.02 },
    class4: { lowerProfitsLimit: 12570, upperProfitsLimit: 50270, mainRate: 0.06, additionalRate: 0.02 },
    class2: { smallProfitsThreshold: 6725 },
    studentLoans: {
      none: { label: "None", threshold: 0, rate: 0 },
      plan1: { label: "Plan 1", threshold: 24990, rate: 0.09 },
      plan2: { label: "Plan 2", threshold: 27295, rate: 0.09 },
      plan4: { label: "Plan 4", threshold: 31395, rate: 0.09 },
      plan5: { label: "Plan 5 (repayments not yet due)", threshold: 25000, rate: 0 },
      pgl: { label: "Postgraduate Loan", threshold: 21000, rate: 0.06 },
    },
  },
  "2025/26": {
    personalAllowance: 12570,
    paTaperStart: 100000,
    additionalThreshold: 125140,
    basicBand: 37700,
    dividendAllowance: 500,
    savingsStartingRateMax: 5000,
    psaBasic: 1000,
    psaHigher: 500,
    psaAdditional: 0,
    incomeTaxRates: { basic: 0.2, higher: 0.4, additional: 0.45 },
    dividendRates: { basic: 0.0875, higher: 0.3375, additional: 0.3935 },
    employeeNI: { primaryThreshold: 12570, upperEarningsLimit: 50270, mainRate: 0.08, additionalRate: 0.02 },
    class4: { lowerProfitsLimit: 12570, upperProfitsLimit: 50270, mainRate: 0.06, additionalRate: 0.02 },
    class2: { smallProfitsThreshold: 6845 },
    studentLoans: {
      none: { label: "None", threshold: 0, rate: 0 },
      plan1: { label: "Plan 1", threshold: 26065, rate: 0.09 },
      plan2: { label: "Plan 2", threshold: 28470, rate: 0.09 },
      plan4: { label: "Plan 4", threshold: 32745, rate: 0.09 },
      plan5: { label: "Plan 5 (repayments start from April 2026)", threshold: 25000, rate: 0 },
      pgl: { label: "Postgraduate Loan", threshold: 21000, rate: 0.06 },
    },
  },
  "2026/27": {
    personalAllowance: 12570,
    paTaperStart: 100000,
    additionalThreshold: 125140,
    basicBand: 37700,
    dividendAllowance: 500,
    savingsStartingRateMax: 5000,
    psaBasic: 1000,
    psaHigher: 500,
    psaAdditional: 0,
    incomeTaxRates: { basic: 0.2, higher: 0.4, additional: 0.45 },
    dividendRates: { basic: 0.1075, higher: 0.3575, additional: 0.3935 },
    employeeNI: { primaryThreshold: 12570, upperEarningsLimit: 50270, mainRate: 0.08, additionalRate: 0.02 },
    class4: { lowerProfitsLimit: 12570, upperProfitsLimit: 50270, mainRate: 0.06, additionalRate: 0.02 },
    class2: { smallProfitsThreshold: 6845 },
    studentLoans: {
      none: { label: "None", threshold: 0, rate: 0 },
      plan1: { label: "Plan 1", threshold: 26900, rate: 0.09 },
      plan2: { label: "Plan 2", threshold: 29385, rate: 0.09 },
      plan4: { label: "Plan 4", threshold: 33795, rate: 0.09 },
      plan5: { label: "Plan 5", threshold: 25000, rate: 0.09 },
      pgl: { label: "Postgraduate Loan", threshold: 21000, rate: 0.06 },
    },
  },
};

const DEFAULT_INPUTS: Inputs = {
  taxYear: "2025/26",
  residency: "england",
  employmentIncome: 31500,
  payeTaxDeducted: 0,
  selfEmploymentTurnover: 0,
  selfEmploymentExpenses: 0,
  rentalProfit: 0,
  dividends: 0,
  savingsInterest: 0,
  pensionGross: 0,
  giftAidGross: 0,
  studentLoan: "none",
  paymentsOnAccountPaid: 0,
};

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const positive = (value: number) => Math.max(0, Number(value) || 0);
const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function taxByBands(
  amount: number,
  basicBandAvailable: number,
  higherBandAvailable: number,
  rates: { basic: number; higher: number; additional: number }
) {
  const taxable = positive(amount);
  const basicSlice = Math.min(taxable, Math.max(0, basicBandAvailable));
  const higherSlice = Math.min(Math.max(0, taxable - basicSlice), Math.max(0, higherBandAvailable));
  const additionalSlice = Math.max(0, taxable - basicSlice - higherSlice);

  return {
    tax: round2(basicSlice * rates.basic + higherSlice * rates.higher + additionalSlice * rates.additional),
    slices: {
      basic: round2(basicSlice),
      higher: round2(higherSlice),
      additional: round2(additionalSlice),
    },
  };
}

function calculateTax(input: Inputs) {
  const rules = TAX_RULES[input.taxYear];

  const employment = positive(input.employmentIncome);
  const payeTaxDeducted = positive(input.payeTaxDeducted);
  const turnover = positive(input.selfEmploymentTurnover);
  const expenses = positive(input.selfEmploymentExpenses);
  const selfEmploymentProfit = Math.max(0, turnover - expenses);
  const rentalProfit = positive(input.rentalProfit);
  const dividends = positive(input.dividends);
  const savingsInterest = positive(input.savingsInterest);
  const pensionGross = positive(input.pensionGross);
  const giftAidGross = positive(input.giftAidGross);
  const paymentsOnAccountPaid = positive(input.paymentsOnAccountPaid);

  const nonSavingsIncome = employment + selfEmploymentProfit + rentalProfit;
  const totalIncome = nonSavingsIncome + savingsInterest + dividends;
  const adjustedNetIncome = Math.max(0, totalIncome - pensionGross - giftAidGross);

  const taperReduction =
    adjustedNetIncome > rules.paTaperStart
      ? Math.min(rules.personalAllowance, (adjustedNetIncome - rules.paTaperStart) / 2)
      : 0;

  const personalAllowance = round2(Math.max(0, rules.personalAllowance - taperReduction));

  const paAgainstNonSavings = Math.min(nonSavingsIncome, personalAllowance);
  const paRemainingAfterNonSavings = Math.max(0, personalAllowance - paAgainstNonSavings);
  const paAgainstSavings = Math.min(savingsInterest, paRemainingAfterNonSavings);
  const paRemainingAfterSavings = Math.max(0, paRemainingAfterNonSavings - paAgainstSavings);
  const paAgainstDividends = Math.min(dividends, paRemainingAfterSavings);

  const taxableNonSavings = Math.max(0, nonSavingsIncome - paAgainstNonSavings);
  const taxableSavingsBeforeAllowances = Math.max(0, savingsInterest - paAgainstSavings);
  const taxableDividendsBeforeAllowance = Math.max(0, dividends - paAgainstDividends);

  const bandExtension = pensionGross + giftAidGross;
  const basicBand = rules.basicBand + bandExtension;
  const higherBandAvailable = Math.max(0, rules.additionalThreshold + bandExtension - basicBand);

  const nonSavingsTax = taxByBands(taxableNonSavings, basicBand, higherBandAvailable, rules.incomeTaxRates);

  const savingsStartingRateAvailable = Math.max(0, rules.savingsStartingRateMax - taxableNonSavings);
  const savingsAtStartingRate = Math.min(taxableSavingsBeforeAllowances, savingsStartingRateAvailable);
  let remainingSavings = Math.max(0, taxableSavingsBeforeAllowances - savingsAtStartingRate);

  const taxableIncomeForPSA = taxableNonSavings + taxableSavingsBeforeAllowances + taxableDividendsBeforeAllowance;
  const highestBand =
    taxableIncomeForPSA > rules.additionalThreshold
      ? "additional"
      : taxableIncomeForPSA > rules.basicBand
      ? "higher"
      : "basic";

  const psa =
    highestBand === "additional"
      ? rules.psaAdditional
      : highestBand === "higher"
      ? rules.psaHigher
      : rules.psaBasic;

  const savingsAtPSA = Math.min(remainingSavings, psa);
  remainingSavings = Math.max(0, remainingSavings - savingsAtPSA);

  const basicUsedAfterNonSavings = nonSavingsTax.slices.basic;
  const higherUsedAfterNonSavings = nonSavingsTax.slices.higher;

  const basicBandRemainingForSavings = Math.max(
    0,
    basicBand - basicUsedAfterNonSavings - savingsAtStartingRate - savingsAtPSA
  );

  const higherBandRemainingForSavings = Math.max(0, higherBandAvailable - higherUsedAfterNonSavings);

  const savingsTax = taxByBands(
    remainingSavings,
    basicBandRemainingForSavings,
    higherBandRemainingForSavings,
    rules.incomeTaxRates
  );

  const taxableDividends = Math.max(0, taxableDividendsBeforeAllowance - rules.dividendAllowance);

  const basicUsedBeforeDividends =
    basicUsedAfterNonSavings + savingsAtStartingRate + savingsAtPSA + savingsTax.slices.basic;

  const higherUsedBeforeDividends = higherUsedAfterNonSavings + savingsTax.slices.higher;

  const basicBandRemainingForDividends = Math.max(0, basicBand - basicUsedBeforeDividends);
  const higherBandRemainingForDividends = Math.max(0, higherBandAvailable - higherUsedBeforeDividends);

  const dividendTax = taxByBands(
    taxableDividends,
    basicBandRemainingForDividends,
    higherBandRemainingForDividends,
    rules.dividendRates
  );

  const employeeNIMainBand = Math.min(
    Math.max(0, employment - rules.employeeNI.primaryThreshold),
    rules.employeeNI.upperEarningsLimit - rules.employeeNI.primaryThreshold
  );

  const employeeNIAdditionalBand = Math.max(0, employment - rules.employeeNI.upperEarningsLimit);

  const employeeNI = round2(
    employeeNIMainBand * rules.employeeNI.mainRate +
      employeeNIAdditionalBand * rules.employeeNI.additionalRate
  );

  const class4MainBand = Math.min(
    Math.max(0, selfEmploymentProfit - rules.class4.lowerProfitsLimit),
    rules.class4.upperProfitsLimit - rules.class4.lowerProfitsLimit
  );

  const class4AdditionalBand = Math.max(0, selfEmploymentProfit - rules.class4.upperProfitsLimit);

  const class4NIC = round2(
    class4MainBand * rules.class4.mainRate + class4AdditionalBand * rules.class4.additionalRate
  );

  const class2NIC = 0;

  const loanRule = rules.studentLoans[input.studentLoan];
  const studentLoanBase = employment + selfEmploymentProfit + rentalProfit + savingsInterest + dividends;

  const studentLoanRepayment = round2(
    Math.max(0, studentLoanBase - loanRule.threshold) * loanRule.rate
  );

  const incomeTaxTotal = round2(nonSavingsTax.tax + savingsTax.tax + dividendTax.tax);
  const totalLiability = round2(incomeTaxTotal + class2NIC + class4NIC + studentLoanRepayment);
  const credits = round2(payeTaxDeducted + paymentsOnAccountPaid);
  const balancingPayment = round2(totalLiability - credits);

  const poaBase = Math.max(0, incomeTaxTotal + class4NIC - payeTaxDeducted);
  const paymentsOnAccountRequired =
    poaBase >= 1000 && (totalLiability === 0 || payeTaxDeducted / totalLiability < 0.8);

  const nextYearPOAEach = paymentsOnAccountRequired ? round2(poaBase / 2) : 0;

  const voluntaryClass2Available =
    selfEmploymentProfit > 0 && selfEmploymentProfit < rules.class2.smallProfitsThreshold;

  const riskFlags: string[] = [];

  if (input.residency === "scotland") {
    riskFlags.push("Scottish income tax bands are not included yet. This tool currently uses England/Wales/NI income tax bands.");
  }

  if (adjustedNetIncome > rules.paTaperStart) {
    riskFlags.push("Personal Allowance taper applies because adjusted net income exceeds £100,000.");
  }

  if (turnover > 90000) {
    riskFlags.push("VAT registration threshold may be relevant. Check rolling 12-month taxable turnover.");
  }

  if (dividends > 0) {
    riskFlags.push("Dividend tax depends on band allocation after other income. Director/shareholder planning should be reviewed.");
  }

  if (savingsInterest > 0) {
    riskFlags.push("Savings tax uses starting rate and Personal Savings Allowance. Check actual bank interest statements.");
  }

  if (voluntaryClass2Available) {
    riskFlags.push("Self-employed profits are below the Small Profits Threshold. Voluntary Class 2 NI may be considered for state pension record.");
  }

  if (input.studentLoan === "plan5" && input.taxYear !== "2026/27") {
    riskFlags.push("Plan 5 repayments are not calculated before 2026/27 in this tool.");
  }

  if (studentLoanRepayment > 0) {
    riskFlags.push("Student loan is an annual estimate. Payroll timing and rounding may differ.");
  }

  return {
    employment,
    turnover,
    expenses,
    selfEmploymentProfit,
    rentalProfit,
    dividends,
    savingsInterest,
    pensionGross,
    giftAidGross,
    totalIncome,
    adjustedNetIncome,
    personalAllowance,
    taxableNonSavings,
    taxableSavingsBeforeAllowances,
    taxableDividends,
    nonSavingsTax,
    savingsTax,
    dividendTax,
    incomeTaxTotal,
    employeeNI,
    class2NIC,
    class4NIC,
    studentLoanRepayment,
    totalLiability,
    credits,
    balancingPayment,
    paymentsOnAccountRequired,
    nextYearPOAEach,
    payrollNetEstimate: round2(employment - incomeTaxTotal - employeeNI - studentLoanRepayment),
    riskFlags,
  };
}

function NumberInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="resultRow">
      <span>{label}</span>
      <strong>{typeof value === "number" ? money(value) : value}</strong>
    </div>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className={`summaryBox ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LeadCaptureForm() {
  return (
    <form
      className="leadForm"
      onSubmit={async (event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        await fetch("https://formspree.io/f/xbdwlgdv", {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        window.location.href = "/thank-you";
      }}
    >
      <input type="hidden" name="_subject" value="New UK Tax Lead" />

      <div className="field">
        <label>Name</label>
        <input name="name" placeholder="Your name" required />
      </div>

      <div className="field">
        <label>Email</label>
        <input type="email" name="email" placeholder="you@example.com" required />
      </div>

      <div className="field">
        <label>Phone</label>
        <input name="phone" placeholder="07xxxxxxxxx" required />
      </div>

      <div className="field">
        <label>Tax Year</label>
        <select name="tax_year" required>
          <option value="">Select</option>
          <option>2026/27</option>
          <option>2025/26</option>
          <option>2024/25</option>
          <option>Earlier years</option>
        </select>
      </div>

      <div className="field">
        <label>What do you need help with?</label>
        <select name="service" required>
          <option value="">Select</option>
          <option>Self Assessment</option>
          <option>Limited Company</option>
          <option>Rental Income</option>
          <option>Capital Gains</option>
          <option>Other</option>
        </select>
      </div>

      <div className="field">
        <label>How urgent is this?</label>
        <select name="urgency" required>
          <option value="">Select</option>
          <option>Urgent (24 hours)</option>
          <option>This week</option>
          <option>No rush</option>
        </select>
      </div>

      <div className="field full">
        <label>Message</label>
        <textarea name="message" rows={3} placeholder="Self Assessment, sole trader, dividends, rental income..." required />
      </div>

      <button className="btn btnPrimary full" type="submit">
        Get my tax reviewed by an expert
      </button>

      <p style={{ fontSize: "14px", marginTop: "10px", opacity: 0.8 }}>
        Usually reviewed within 24 hours. No obligation.
      </p>

      <p style={{ fontSize: "13px", marginTop: "10px", opacity: 0.7 }}>
        By submitting, you agree to be contacted regarding your enquiry.
      </p>
    </form>
  );
}

function CalculatorSection() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const result = useMemo(() => calculateTax(inputs), [inputs]);

  const setField = <K extends keyof Inputs>(field: K, value: Inputs[K]) => {
    setInputs((previous) => ({ ...previous, [field]: value }));
  };

  const rules = TAX_RULES[inputs.taxYear];

  const balancingText =
    result.balancingPayment >= 0
      ? `${money(result.balancingPayment)} due`
      : `${money(Math.abs(result.balancingPayment))} refund`;

  return (
    <section id="calculator" className="section">
      <div className="container">
        <h2 className="sectionTitle">UK Self Assessment Calculator</h2>
        <p className="sectionLead">
          Estimate UK Income Tax, PAYE credits, Class 4 NI, dividends, savings income, rental income and student loan repayments across multiple tax years.
        </p>

        <div className="calculatorWrap">
          <div className="card">
            <h3>Input details</h3>

            <div className="field">
              <label>Tax year</label>
              <select value={inputs.taxYear} onChange={(event) => setField("taxYear", event.target.value as TaxYear)}>
                <option value="2026/27">2026/27</option>
                <option value="2025/26">2025/26</option>
                <option value="2024/25">2024/25</option>
              </select>
            </div>

            <div className="field">
              <label>Tax residency / income tax regime</label>
              <select value={inputs.residency} onChange={(event) => setField("residency", event.target.value as Inputs["residency"])}>
                <option value="england">England / Wales / Northern Ireland</option>
                <option value="scotland">Scotland (flag only)</option>
              </select>
            </div>

            <div className="inputGrid" style={{ marginTop: 14 }}>
              <NumberInput label="Employment income" value={inputs.employmentIncome} onChange={(value) => setField("employmentIncome", value)} />
              <NumberInput label="PAYE tax deducted" value={inputs.payeTaxDeducted} onChange={(value) => setField("payeTaxDeducted", value)} hint="Leave as £0 to show liability before PAYE credits." />
              <NumberInput label="Sole trader turnover" value={inputs.selfEmploymentTurnover} onChange={(value) => setField("selfEmploymentTurnover", value)} />
              <NumberInput label="Allowable expenses" value={inputs.selfEmploymentExpenses} onChange={(value) => setField("selfEmploymentExpenses", value)} />
              <NumberInput label="Rental profit" value={inputs.rentalProfit} onChange={(value) => setField("rentalProfit", value)} />
              <NumberInput label="Dividends" value={inputs.dividends} onChange={(value) => setField("dividends", value)} />
              <NumberInput label="Savings interest" value={inputs.savingsInterest} onChange={(value) => setField("savingsInterest", value)} />
              <NumberInput label="Gross pension contributions" value={inputs.pensionGross} onChange={(value) => setField("pensionGross", value)} />
              <NumberInput label="Gross Gift Aid" value={inputs.giftAidGross} onChange={(value) => setField("giftAidGross", value)} />
              <NumberInput label="Payments on account paid" value={inputs.paymentsOnAccountPaid} onChange={(value) => setField("paymentsOnAccountPaid", value)} />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Student loan</label>
              <select value={inputs.studentLoan} onChange={(event) => setField("studentLoan", event.target.value as StudentLoanKey)}>
                {Object.entries(rules.studentLoans).map(([key, plan]) => (
                  <option key={key} value={key}>
                    {plan.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="card">
              <div className="summaryGrid">
                <SummaryBox label="Total income" value={money(result.totalIncome)} />
                <SummaryBox label="Total liability" value={money(result.totalLiability)} />
                <SummaryBox label="Final position" value={balancingText} tone={result.balancingPayment >= 0 ? "danger" : "success"} />
              </div>

              <div className="resultsGrid">
                <div>
                  <h3>Income breakdown</h3>
                  <ResultRow label="Employment income" value={result.employment} />
                  <ResultRow label="Sole trader profit" value={result.selfEmploymentProfit} />
                  <ResultRow label="Rental profit" value={result.rentalProfit} />
                  <ResultRow label="Savings interest" value={result.savingsInterest} />
                  <ResultRow label="Dividends" value={result.dividends} />
                  <ResultRow label="Adjusted net income" value={result.adjustedNetIncome} />
                  <ResultRow label="Personal Allowance" value={result.personalAllowance} />
                </div>

                <div>
                  <h3>Tax & NI breakdown</h3>
                  <ResultRow label="Income tax" value={result.incomeTaxTotal} />
                  <ResultRow label="Class 4 NI" value={result.class4NIC} />
                  <ResultRow label="Student loan estimate" value={result.studentLoanRepayment} />
                  <ResultRow label="Less PAYE / POA credits" value={-result.credits} />
                  <ResultRow label="Final SA position" value={result.balancingPayment} />
                  <ResultRow label="Employee NI estimate" value={result.employeeNI} />
                  <ResultRow label="Payroll net salary estimate" value={result.payrollNetEstimate} />
                </div>
              </div>

              {result.riskFlags.length > 0 && (
                <div className="warning">
                  <strong>Review flags</strong>
                  <ul>
                    {result.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.paymentsOnAccountRequired && (
                <div className="warning">
                  Estimated payments on account may be required. Each payment would be approximately {money(result.nextYearPOAEach)}.
                </div>
              )}
              {result.riskFlags.length > 0 && (
  <div style={{
    marginTop: "20px",
    padding: "20px",
    background: "#fee2e2",
    borderRadius: "10px"
  }}>
    <h4>⚠️ Important based on your inputs</h4>

    <ul>
      {result.riskFlags.slice(0,2).map(flag => (
        <li key={flag}>{flag}</li>
      ))}
    </ul>

    <a
      href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20reviewing%20my%20tax%20calculation."
      style={{
        display: "inline-block",
        marginTop: "10px",
        padding: "10px 16px",
        background: "#dc2626",
        color: "white",
        borderRadius: "6px",
        textDecoration: "none"
      }}
    >
      Get this reviewed by an expert
    </a>
  </div>
)}
            </div>

            <div className="ctaPanel">
              <h3>Not sure if this is accurate?</h3>
              <p>
                Avoid overpaying tax or making costly mistakes. Get your figures checked by a UK accountant before submitting to HMRC.
              </p>
              <p style={{ marginTop: "10px", fontWeight: "bold" }}>
                ⚡ Most reviews identify savings or corrections.
              </p>
              <div style={{ marginTop: "15px" }}>
  <a
    href="https://haladigital.co.uk/company-formation"
    style={{
      display: "inline-block",
      padding: "12px 18px",
      background: "#0f172a",
      color: "white",
      borderRadius: "6px",
      textDecoration: "none",
      fontWeight: "bold"
    }}
  >
    Starting a business? Set up your LTD company →
  </a>
</div>
              <LeadCaptureForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <header className="header">
        <div className="container nav">
          <a className="logoBlock" href="#">
            <span className="logo">UK Tax Calculator</span>
            <span className="powered">Powered by Hala Digital Ltd</span>
          </a>
          <nav className="navLinks">
            <a href="#calculator">Calculator</a>
            <a href="https://haladigital.co.uk/vat-sic">VAT SIC Tool</a>
            <a href="https://haladigital.co.uk/quote">Website Quote</a>
            <a className="btn btnDark" href="#calculator">Try calculator</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container heroGrid">
            <div>
              <span className="badge">2024/25 • 2025/26 • 2026/27</span>
              <h1>Estimate your UK tax in 30 seconds.</h1>
              <p>
                Multi-year UK tax estimates for employees, sole traders, landlords, company directors and mixed income cases.
              </p>
              <div className="heroActions">
                <a className="btn btnPrimary" href="#calculator">Calculate My Tax Now</a>
                <a className="btn btnLight" href="https://haladigital.co.uk">Hala Digital Tools</a>
              </div>
            </div>

            <div className="heroCard">
              <h3>Included in this calculator</h3>
              <div className="heroMetric">
                <strong>3 years</strong>
                <span>2024/25, 2025/26 and 2026/27</span>
              </div>
              <div className="heroMetric">
                <strong>Multiple incomes</strong>
                <span>PAYE, self-employed, rental, dividends and savings</span>
              </div>
              <div className="heroMetric">
                <strong>Lead review</strong>
                <span>Get accountant review before filing</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section">
          <div className="container">
            <h2 className="sectionTitle">Built for practical UK tax estimates.</h2>
            <p className="sectionLead">
              This tool gives an indicative calculation and highlights areas where professional review may be needed.
            </p>
            <div className="grid3">
              <div className="featureCard">
                <h3>Multi-year support</h3>
                <p>Select 2024/25, 2025/26 or 2026/27 and compare tax year rules.</p>
              </div>
              <div className="featureCard">
                <h3>Mixed income support</h3>
                <p>Estimate tax across PAYE, self-employment, dividends, savings and property income.</p>
              </div>
              <div className="featureCard">
                <h3>Review flags</h3>
                <p>Highlights areas such as VAT threshold, dividends, savings, student loans and PA taper.</p>
              </div>
            </div>
          </div>
        </section>

        <CalculatorSection />
        <div style={{
  marginTop: "50px",
  padding: "30px",
  background: "#fef3c7",
  borderRadius: "12px",
  textAlign: "center"
}}>
  <h3>Need help staying MTD compliant?</h3>

  <p style={{ marginTop: "10px", maxWidth: "600px", marginInline: "auto" }}>
    Making Tax Digital is changing how businesses report to HMRC. 
    Avoid penalties and get your tax returns handled correctly by a UK accountant.
  </p>

  <div style={{ marginTop: "20px" }}>
    <a
      href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20with%20MTD%20and%20tax%20returns."
      style={{
        padding: "12px 20px",
        background: "#25D366",
        color: "white",
        borderRadius: "8px",
        textDecoration: "none",
        marginRight: "10px"
      }}
    >
      Chat on WhatsApp
    </a>

    <a
      href="/quote"
      style={{
        padding: "12px 20px",
        background: "#2563eb",
        color: "white",
        borderRadius: "8px",
        textDecoration: "none"
      }}
    >
      Get a Quote
    </a>
  </div>

  <p style={{ marginTop: "10px", fontSize: "14px", opacity: 0.8 }}>
    Transparent pricing. No hidden fees.
  </p>
</div>
 <section className="section">
  <div className="container">
    <div
      style={{
        marginTop: "20px",
        padding: "30px",
        background: "#eef6ff",
        borderRadius: "12px",
        textAlign: "center",
      }}
    >
      <h3>Starting a new limited company?</h3>

      <p style={{ marginTop: "10px", maxWidth: "650px", marginInline: "auto" }}>
        We help you set up your UK limited company, complete Companies House filing and arrange identity verification through an authorised Companies House agent.
      </p>

      <div style={{ marginTop: "20px" }}>
        <a
          href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20want%20to%20set%20up%20a%20limited%20company."
          style={{
            padding: "12px 20px",
            background: "#25D366",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            marginRight: "10px",
            display: "inline-block",
          }}
        >
          Start on WhatsApp
        </a>

        <a
          href="https://haladigital.co.uk/quote"
          style={{
            padding: "12px 20px",
            background: "#2563eb",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Get Formation Quote
        </a>
      </div>

      <p style={{ marginTop: "10px", fontSize: "14px", opacity: 0.8 }}>
        Company formation, compliance guidance and accountant support available.
      </p>
    </div>
  </div>
</section>
        <section className="section">
  <div className="container">
    <div className="grid3">
      <div className="featureCard">
        <h3>MTD Tax Support</h3>
        <p>Get help becoming MTD-ready and keeping your tax records compliant.</p>
        <a href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20with%20MTD%20tax%20support.">
          Enquire about MTD →
        </a>
      </div>

      <div className="featureCard">
        <h3>Company Formation</h3>
        <p>Set up your UK limited company with accountant support and compliance guidance.</p>
        <a href="https://haladigital.co.uk/company-formation">
          Start company setup →
        </a>
      </div>

      <div className="featureCard">
        <h3>VAT SIC Tool</h3>
        <p>Check likely VAT treatment and risk flags by SIC code.</p>
        <a href="https://haladigital.co.uk/vat-sic">
          Try VAT SIC tool →
        </a>
      </div>
    </div>
  </div>
</section>
        <section className="section">
          <div className="container">
            <div className="disclaimer">
              <div style={{ marginTop: "20px" }}>
  <a
    href="/how-to-start-a-limited-company-uk"
    style={{
      display: "inline-block",
      padding: "10px 16px",
      background: "#eef6ff",
      color: "#0f172a",
      borderRadius: "6px",
      textDecoration: "none",
      fontWeight: "bold"
    }}
  >
    Thinking of starting a business? Read this guide →
  </a>
</div>
              <strong>Important disclaimer:</strong> This tool provides estimated calculations and general guidance only. It does not replace professional tax advice. Final tax figures should be reviewed by a qualified accountant before submission to HMRC. Scottish income tax, CGT, HICBC, foreign income, residence issues, property finance restriction and complex student loan cases require professional review.
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footerFlex">
          <span>© {new Date().getFullYear()} Hala Digital Ltd. UK Tax Calculator is a Hala Digital product.</span>
          <span>Testing calculator • Not final tax filing software</span>
        </div>
      </footer>
    </>
  );
}
