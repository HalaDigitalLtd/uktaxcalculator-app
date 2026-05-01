
"use client";

import { useMemo, useState } from "react";

type StudentLoanKey = "none" | "plan1" | "plan2" | "plan4" | "plan5" | "pgl";

type Inputs = {
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

type TestCase = {
  name: string;
  input: Inputs;
  expected: Record<string, number>;
};

const TAX_YEAR = "2025/26";

const RULES = {
  personalAllowance: 12570,
  paTaperStart: 100000,
  basicBand: 37700,
  higherBandUpperTaxable: 125140,
  dividendAllowance: 500,
  savingsStartingRateMax: 5000,
  personalSavingsAllowanceBasic: 1000,
  personalSavingsAllowanceHigher: 500,
  personalSavingsAllowanceAdditional: 0,
  employeeNI: {
    primaryThreshold: 12570,
    upperEarningsLimit: 50270,
    mainRate: 0.08,
    additionalRate: 0.02,
  },
  incomeTaxRates: {
    basic: 0.2,
    higher: 0.4,
    additional: 0.45,
  },
  dividendRates: {
    basic: 0.0875,
    higher: 0.3375,
    additional: 0.3935,
  },
  class2: {
    smallProfitsThreshold: 6845,
  },
  class4: {
    lowerProfitsLimit: 12570,
    upperProfitsLimit: 50270,
    mainRate: 0.06,
    additionalRate: 0.02,
  },
  studentLoans: {
    none: { label: "None", threshold: 0, rate: 0 },
    plan1: { label: "Plan 1", threshold: 26065, rate: 0.09 },
    plan2: { label: "Plan 2", threshold: 28470, rate: 0.09 },
    plan4: { label: "Plan 4", threshold: 32745, rate: 0.09 },
    plan5: { label: "Plan 5 (no 2025/26 repayment)", threshold: 25000, rate: 0 },
    pgl: { label: "Postgraduate Loan", threshold: 21000, rate: 0.06 },
  },
};

const DEFAULT_INPUTS: Inputs = {
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

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const positive = (value: number) => Math.max(0, Number(value) || 0);

function taxByBands(
  amount: number,
  basicBandAvailable: number,
  higherBandAvailable: number,
  rates: { basic: number; higher: number; additional: number }
) {
  const taxable = positive(amount);
  const basicSlice = Math.min(taxable, Math.max(0, basicBandAvailable));
  const higherSlice = Math.min(
    Math.max(0, taxable - basicSlice),
    Math.max(0, higherBandAvailable)
  );
  const additionalSlice = Math.max(0, taxable - basicSlice - higherSlice);

  return {
    tax: round2(
      basicSlice * rates.basic +
        higherSlice * rates.higher +
        additionalSlice * rates.additional
    ),
    slices: {
      basic: round2(basicSlice),
      higher: round2(higherSlice),
      additional: round2(additionalSlice),
    },
  };
}

function calculateTax(input: Inputs) {
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
    adjustedNetIncome > RULES.paTaperStart
      ? Math.min(RULES.personalAllowance, (adjustedNetIncome - RULES.paTaperStart) / 2)
      : 0;
  const personalAllowance = round2(Math.max(0, RULES.personalAllowance - taperReduction));

  const paAgainstNonSavings = Math.min(nonSavingsIncome, personalAllowance);
  const paRemainingAfterNonSavings = Math.max(0, personalAllowance - paAgainstNonSavings);
  const paAgainstSavings = Math.min(savingsInterest, paRemainingAfterNonSavings);
  const paRemainingAfterSavings = Math.max(0, paRemainingAfterNonSavings - paAgainstSavings);
  const paAgainstDividends = Math.min(dividends, paRemainingAfterSavings);

  const taxableNonSavings = Math.max(0, nonSavingsIncome - paAgainstNonSavings);
  const taxableSavingsBeforeAllowances = Math.max(0, savingsInterest - paAgainstSavings);
  const taxableDividendsBeforeAllowance = Math.max(0, dividends - paAgainstDividends);

  const bandExtension = pensionGross + giftAidGross;
  const basicBand = RULES.basicBand + bandExtension;
  const higherBandAvailable = Math.max(
    0,
    RULES.higherBandUpperTaxable - RULES.personalAllowance - basicBand
  );

  const nonSavingsTax = taxByBands(
    taxableNonSavings,
    basicBand,
    higherBandAvailable,
    RULES.incomeTaxRates
  );

  const savingsStartingRateAvailable = Math.max(
    0,
    RULES.savingsStartingRateMax - taxableNonSavings
  );
  const savingsAtStartingRate = Math.min(
    taxableSavingsBeforeAllowances,
    savingsStartingRateAvailable
  );
  let remainingSavings = Math.max(0, taxableSavingsBeforeAllowances - savingsAtStartingRate);

  const taxableIncomeBeforeSavingsBands =
    taxableNonSavings + taxableSavingsBeforeAllowances + taxableDividendsBeforeAllowance;

  const highestBand =
    taxableIncomeBeforeSavingsBands > RULES.higherBandUpperTaxable - RULES.personalAllowance
      ? "additional"
      : taxableIncomeBeforeSavingsBands > RULES.basicBand
      ? "higher"
      : "basic";

  const psa =
    highestBand === "additional"
      ? RULES.personalSavingsAllowanceAdditional
      : highestBand === "higher"
      ? RULES.personalSavingsAllowanceHigher
      : RULES.personalSavingsAllowanceBasic;

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
    RULES.incomeTaxRates
  );

  const taxableDividends = Math.max(0, taxableDividendsBeforeAllowance - RULES.dividendAllowance);
  const basicUsedBeforeDividends =
    basicUsedAfterNonSavings + savingsAtStartingRate + savingsAtPSA + savingsTax.slices.basic;
  const higherUsedBeforeDividends = higherUsedAfterNonSavings + savingsTax.slices.higher;

  const basicBandRemainingForDividends = Math.max(0, basicBand - basicUsedBeforeDividends);
  const higherBandRemainingForDividends = Math.max(0, higherBandAvailable - higherUsedBeforeDividends);

  const dividendTax = taxByBands(
    taxableDividends,
    basicBandRemainingForDividends,
    higherBandRemainingForDividends,
    RULES.dividendRates
  );

  const class2NIC = 0;
  const voluntaryClass2Available =
    selfEmploymentProfit > 0 && selfEmploymentProfit < RULES.class2.smallProfitsThreshold;

  const class4MainBand = Math.min(
    Math.max(0, selfEmploymentProfit - RULES.class4.lowerProfitsLimit),
    RULES.class4.upperProfitsLimit - RULES.class4.lowerProfitsLimit
  );
  const class4AdditionalBand = Math.max(0, selfEmploymentProfit - RULES.class4.upperProfitsLimit);
  const class4NIC = round2(
    class4MainBand * RULES.class4.mainRate + class4AdditionalBand * RULES.class4.additionalRate
  );

  const employeeNIMainBand = Math.min(
    Math.max(0, employment - RULES.employeeNI.primaryThreshold),
    RULES.employeeNI.upperEarningsLimit - RULES.employeeNI.primaryThreshold
  );
  const employeeNIAdditionalBand = Math.max(0, employment - RULES.employeeNI.upperEarningsLimit);
  const employeeNI = round2(
    employeeNIMainBand * RULES.employeeNI.mainRate +
      employeeNIAdditionalBand * RULES.employeeNI.additionalRate
  );

  const loanRule = RULES.studentLoans[input.studentLoan];
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

  const riskFlags: string[] = [];

  if (input.residency === "scotland") {
    riskFlags.push("Scottish income tax bands are not included yet. Use accountant review.");
  }
  if (adjustedNetIncome > RULES.paTaperStart) {
    riskFlags.push("Personal Allowance taper applies because adjusted net income exceeds £100,000.");
  }
  if (turnover > 90000) {
    riskFlags.push("VAT registration threshold may be relevant. Check rolling 12-month taxable turnover.");
  }
  if (dividends > 0) {
    riskFlags.push("Dividend tax depends on band allocation after other income. Review director/shareholder planning.");
  }
  if (savingsInterest > 0) {
    riskFlags.push("Savings tax uses starting rate and Personal Savings Allowance. Check bank statements.");
  }
  if (voluntaryClass2Available) {
    riskFlags.push("Profits below Small Profits Threshold: voluntary Class 2 NI may be considered for state pension record.");
  }
  if (input.studentLoan === "plan5") {
    riskFlags.push("Plan 5 repayments start from April 2026, so no 2025/26 repayment is calculated.");
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
    nonSavingsIncome,
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
    class2NIC,
    class4NIC,
    employeeNI,
    payrollNetEstimate: round2(employment - nonSavingsTax.tax - employeeNI - studentLoanRepayment),
    studentLoanRepayment,
    totalLiability,
    credits,
    balancingPayment,
    paymentsOnAccountRequired,
    nextYearPOAEach,
    riskFlags,
  };
}

const testCases: TestCase[] = [
  {
    name: "Salary only £31,500, no PAYE entered",
    input: { ...DEFAULT_INPUTS, employmentIncome: 31500, payeTaxDeducted: 0 },
    expected: {
      incomeTaxTotal: 3786,
      employeeNI: 1514.4,
      payrollNetEstimate: 26199.6,
      totalLiability: 3786,
      balancingPayment: 3786,
    },
  },
  {
    name: "PAYE only, basic rate with PAYE tax deducted",
    input: { ...DEFAULT_INPUTS, employmentIncome: 30000, payeTaxDeducted: 3486 },
    expected: { incomeTaxTotal: 3486, employeeNI: 1394.4, balancingPayment: 0 },
  },
  {
    name: "PAYE + sole trader profit",
    input: {
      ...DEFAULT_INPUTS,
      employmentIncome: 42000,
      payeTaxDeducted: 5900,
      selfEmploymentTurnover: 28000,
      selfEmploymentExpenses: 8500,
    },
    expected: {
      selfEmploymentProfit: 19500,
      incomeTaxTotal: 12032,
      class4NIC: 415.8,
      balancingPayment: 6547.8,
    },
  },
  {
    name: "High income PA taper",
    input: { ...DEFAULT_INPUTS, employmentIncome: 110000, payeTaxDeducted: 31000 },
    expected: { personalAllowance: 7570, incomeTaxTotal: 31432, balancingPayment: 432 },
  },
  {
    name: "Director dividends",
    input: { ...DEFAULT_INPUTS, employmentIncome: 12570, dividends: 40000 },
    expected: { incomeTaxTotal: 3456.25, dividendTax: 3456.25, balancingPayment: 3456.25 },
  },
  {
    name: "Savings within PSA",
    input: { ...DEFAULT_INPUTS, employmentIncome: 25000, payeTaxDeducted: 2486, savingsInterest: 800 },
    expected: { incomeTaxTotal: 2486, savingsTax: 0, balancingPayment: 0 },
  },
  {
    name: "Class 4 NI main and additional bands",
    input: { ...DEFAULT_INPUTS, employmentIncome: 0, selfEmploymentTurnover: 90000, selfEmploymentExpenses: 10000 },
    expected: { selfEmploymentProfit: 80000, incomeTaxTotal: 19432, class4NIC: 3007.4, balancingPayment: 22439.4 },
  },
  {
    name: "Salary only £31,500 with PAYE matched",
    input: { ...DEFAULT_INPUTS, employmentIncome: 31500, payeTaxDeducted: 3786 },
    expected: { incomeTaxTotal: 3786, balancingPayment: 0 },
  },
  {
    name: "No income at all",
    input: { ...DEFAULT_INPUTS, employmentIncome: 0 },
    expected: { totalIncome: 0, incomeTaxTotal: 0, employeeNI: 0, totalLiability: 0, balancingPayment: 0 },
  },
  {
    name: "Plan 5 selected in 2025/26 should not calculate repayment",
    input: { ...DEFAULT_INPUTS, employmentIncome: 31500, studentLoan: "plan5" },
    expected: { studentLoanRepayment: 0, totalLiability: 3786 },
  },
  {
    name: "Plan 2 salary-only annual estimate",
    input: { ...DEFAULT_INPUTS, employmentIncome: 31500, studentLoan: "plan2" },
    expected: { studentLoanRepayment: 272.7, totalLiability: 4058.7 },
  },
  {
    name: "Basic salary with dividends using dividend allowance",
    input: { ...DEFAULT_INPUTS, employmentIncome: 20000, dividends: 2000 },
    expected: { dividendTax: 131.25, incomeTaxTotal: 1617.25 },
  },
];

function runExpectedChecks(testCase: TestCase) {
  const calculated = calculateTax(testCase.input);
  const checks = Object.entries(testCase.expected).map(([key, expectedValue]) => {
    const actualValue = (calculated as unknown as Record<string, number>)[key];
    const pass = Math.abs(round2(actualValue) - round2(expectedValue)) <= 0.01;
    return { key, expectedValue, actualValue, pass };
  });

  return {
    calculated,
    checks,
    passed: checks.every((check) => check.pass),
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

function ResultRow({ label, value, strong = false }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className="resultRow">
      <span>{label}</span>
      <strong>{typeof value === "number" ? money(value) : value}</strong>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
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
  onSubmit={async (e) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    await fetch("https://formspree.io/f/xbdwlgdv", {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    window.location.href = "/thank-you";
  }}
>    
      <div className="field">
        <label>Name</label>
        <input name="name" placeholder="Your name" required />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="hidden" name="_subject" value="New UK Tax Lead" />
        <input type="email" name="email" placeholder="you@example.com" required />
      </div>
      <div className="field full">
        <label>What do you need help with?</label>
        <textarea name="message" rows={3} placeholder="Self Assessment, sole trader, dividends, rental income..." required />
      </div>
      <button className="btn btnPrimary full" type="submit">
        Request accountant review
      </button>
    </form>
  );
}

function CalculatorSection() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const result = useMemo(() => calculateTax(inputs), [inputs]);

  const setField = <K extends keyof Inputs>(field: K, value: Inputs[K]) => {
    setInputs((previous) => ({ ...previous, [field]: value }));
  };

  const balancingText =
    result.balancingPayment >= 0
      ? `${money(result.balancingPayment)} due`
      : `${money(Math.abs(result.balancingPayment))} refund`;

  return (
    <section id="calculator" className="section">
      <div className="container">
        <h2 className="sectionTitle">UK Self Assessment Calculator 2025/26</h2>
        <p className="sectionLead">
          This testing version estimates UK Income Tax, Class 4 National Insurance, student loan and PAYE credits for common Self Assessment cases.
        </p>

        <div className="calculatorWrap">
          <div className="card">
            <h3>Input details</h3>

            <div className="field">
              <label>Tax residency / income tax regime</label>
              <select value={inputs.residency} onChange={(event) => setField("residency", event.target.value as Inputs["residency"])}>
                <option value="england">England / Wales / Northern Ireland</option>
                <option value="scotland">Scotland (flag only in prototype)</option>
              </select>
            </div>

            <div className="inputGrid" style={{ marginTop: 14 }}>
              <NumberInput label="Employment income" value={inputs.employmentIncome} onChange={(value) => setField("employmentIncome", value)} />
              <NumberInput label="PAYE tax deducted" value={inputs.payeTaxDeducted} onChange={(value) => setField("payeTaxDeducted", value)} hint="Leave as £0 to show tax before PAYE credits" />
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
                {Object.entries(RULES.studentLoans).map(([key, plan]) => (
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
                <SummaryBox label="SA liability" value={money(result.totalLiability)} />
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
                  <ResultRow label="Employee NI payroll estimate" value={result.employeeNI} />
                  <ResultRow label="Payroll net salary estimate" value={result.payrollNetEstimate} />
                </div>
              </div>

              {result.riskFlags.length > 0 ? (
                <div className="warning">
                  <strong>Review flags</strong>
                  <ul>
                    {result.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.paymentsOnAccountRequired ? (
                <div className="warning">
                  Estimated payments on account may be required. Each payment would be approximately {money(result.nextYearPOAEach)}.
                </div>
              ) : null}
            </div>

            <div className="ctaPanel">
              <h3>Not sure if this is accurate?</h3>

<p>
You could be overpaying tax without realising it.
Submit your details and a UK accountant will review your figures before anything is filed with HMRC.
</p>
              <p style={{ marginTop: "10px", fontWeight: "bold" }}>
⚡ Most reviews identify savings or corrections.
</p>
              <LeadCaptureForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestsSection() {
  const testResults = testCases.map(runExpectedChecks);
  const allPassed = testResults.every((test) => test.passed);

  return (
    <section id="tests" className="section">
      <div className="container">
        <h2 className="sectionTitle">Built-in test checks</h2>
        <p className="sectionLead">
          These tests are included to reduce calculation risk while the prototype develops. Status: <strong>{allPassed ? "All tests passed" : "Some tests failed"}</strong>.
        </p>

        <div className="testsGrid">
          {testCases.map((testCase, index) => {
            const test = testResults[index];
            return (
              <div className="card" key={testCase.name}>
                <div className="testHeader">
                  <h3>{testCase.name}</h3>
                  <span className={test.passed ? "pass" : "fail"}>{test.passed ? "PASS" : "FAIL"}</span>
                </div>

                <ResultRow label="Income tax" value={test.calculated.incomeTaxTotal} />
                <ResultRow label="Class 4 NI" value={test.calculated.class4NIC} />
                <ResultRow label="Student loan" value={test.calculated.studentLoanRepayment} />
                <ResultRow label="Total SA liability" value={test.calculated.totalLiability} />

                <div className="testChecks">
                  {test.checks.map((check) => (
                    <div className="checkRow" key={check.key}>
                      <span>
                        {check.pass ? "✓" : "✕"} {check.key}
                      </span>
                      <span>
                        Expected {money(check.expectedValue)} / Actual {money(check.actualValue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
            <a href="#features">Features</a>
            <a href="#tests">Tests</a>
            <a href="#pricing">For accountants</a>
            <a className="btn btnDark" href="#calculator">Try calculator</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container heroGrid">
            <div>
              <span className="badge">Tax Year {TAX_YEAR} • Testing prototype</span>
              <h1>Estimate your UK tax in 30 seconds.</h1>
              <p>
                Instant HMRC-aligned tax estimates for employees, landlords and company directors. No signup required.
              </p>
              <div className="heroActions">
                <a className="btn btnPrimary" href="#calculator">Calculate My Tax Now</a>
                <a className="btn btnLight" href="#pricing">Get Accountant Review</a>
              </div>
            </div>
            <div className="heroCard">
              <h3>Product roadmap</h3>
              <div className="heroMetric">
                <strong>Phase 1</strong>
                <span>Self Assessment calculator and lead capture</span>
              </div>
              <div className="heroMetric">
                <strong>Phase 2</strong>
                <span>White-label tools for accountants</span>
              </div>
              <div className="heroMetric">
                <strong>Phase 3</strong>
                <span>Firm dashboard, SaaS billing and client reports</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section">
          <div className="container">
            <h2 className="sectionTitle">Built for trust, testing and future scale.</h2>
            <p className="sectionLead">
              The first version focuses on safe tax estimates and clear warnings. The long-term version can become a full SaaS platform for UK accountancy firms.
            </p>
            <div className="grid3">
              <div className="featureCard">
                <h3>Calculator-first product</h3>
                <p>Users can estimate PAYE, sole trader profit, dividends, savings income, Class 4 NI and student loan in one place.</p>
              </div>
              <div className="featureCard">
                <h3>Lead generation</h3>
                <p>Every calculation can convert into an accountant review enquiry, making the tool commercially useful.</p>
              </div>
              <div className="featureCard">
                <h3>White-label future</h3>
                <p>Later, accountants can add their own branding and use the platform on their own websites.</p>
              </div>
            </div>
          </div>
        </section>

        <CalculatorSection />

        <section id="pricing" className="section">
          <div className="container">
            <h2 className="sectionTitle">For accountancy practices</h2>
            <p className="sectionLead">
              Future SaaS model: accountants subscribe to use calculators, lead capture forms and client-facing tax tools on their own websites.
            </p>
            <div className="grid3">
              <div className="featureCard">
                <h3>Starter</h3>
                <p>Calculator embed, practice branding and enquiry capture.</p>
              </div>
              <div className="featureCard">
                <h3>Practice</h3>
                <p>Multiple tools, lead dashboard, email notifications and firm-level settings.</p>
              </div>
              <div className="featureCard">
                <h3>Pro</h3>
                <p>White-label subdomain, reporting, advanced tools and priority support.</p>
              </div>
            </div>
          </div>
        </section>

        <TestsSection />

        <section className="section">
          <div className="container">
            <div className="disclaimer">
              <strong>Important disclaimer:</strong> This tool provides estimated calculations and general guidance only. It does not replace professional tax advice. Final tax figures should be reviewed by a qualified accountant before submission to HMRC. Complex cases including Scottish taxpayers, CGT, HICBC, foreign income, residence issues, property finance restriction and multiple student loan plans require professional review.
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footerFlex">
          <span>© {new Date().getFullYear()} Hala Digital Ltd. UK Tax Calculator is a Hala Digital product.</span>
          <span>Testing prototype • Not final tax filing software</span>
        </div>
      </footer>
    </>
  );
}
