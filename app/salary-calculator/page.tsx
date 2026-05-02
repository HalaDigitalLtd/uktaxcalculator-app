export default function SalaryCalculatorPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>UK Tax Calculator</p>

        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Salary Calculator UK
        </h1>

        <p style={{ maxWidth: "760px", margin: "0 auto", fontSize: "19px", opacity: 0.9 }}>
          Estimate your take-home pay, PAYE tax and National Insurance using our UK tax calculator.
        </p>

        <div style={{ marginTop: "28px" }}>
          <a
            href="https://www.uktaxcalculator.co.uk/#calculator"
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
              margin: "8px",
            }}
          >
            Use Salary Calculator
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20checking%20my%20salary%20tax."
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
              margin: "8px",
            }}
          >
            Ask an Accountant
          </a>
        </div>
      </section>

      <main style={{ maxWidth: "950px", margin: "0 auto", padding: "60px 20px" }}>
        <h2>What is a salary calculator?</h2>
        <p>
          A salary calculator helps estimate how much income tax and National Insurance may be deducted from your gross salary,
          giving you an indicative take-home pay figure.
        </p>

        <div style={{ padding: "24px", background: "#eef6ff", borderRadius: "14px", margin: "30px 0" }}>
          <h3>Quick access</h3>
          <p>
            Use our live calculator to estimate salary tax, PAYE, employee National Insurance and student loan deductions.
          </p>

          <a
            href="https://www.uktaxcalculator.co.uk/#calculator"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Open the Tax Calculator →
          </a>
        </div>

        <h2>What deductions affect take-home pay?</h2>
        <ul>
          <li>PAYE income tax</li>
          <li>Employee National Insurance</li>
          <li>Student loan repayments</li>
          <li>Pension contributions</li>
          <li>Benefits, tax code changes and payroll adjustments</li>
        </ul>

        <h2>Why your payslip may differ from an online estimate</h2>
        <p>
          Payroll calculations can vary because of tax codes, cumulative pay, bonuses, benefits, salary sacrifice,
          pension deductions and student loan timing. A calculator gives an estimate, not a final payroll calculation.
        </p>

        <h2>When should salary tax be reviewed?</h2>
        <p>
          You should consider a review if your tax code changed, your income increased, you have multiple jobs,
          you receive benefits in kind, your salary is over £100,000, or you think too much tax has been deducted.
        </p>

        <div style={{ marginTop: "40px", padding: "28px", background: "#f0fdf4", borderRadius: "14px", textAlign: "center" }}>
          <h3>Think your salary tax is wrong?</h3>
          <p style={{ maxWidth: "680px", margin: "10px auto" }}>
            Get your payslip and tax position reviewed by a UK accountant before contacting HMRC.
          </p>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20checking%20my%20salary%20tax."
            style={{
              display: "inline-block",
              marginTop: "14px",
              padding: "12px 20px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Ask for Salary Tax Review →
          </a>
        </div>

        <h2>Salary Calculator FAQs</h2>

        <h3>How is take-home pay calculated in the UK?</h3>
        <p>
          Take-home pay is usually gross salary less PAYE income tax, employee National Insurance, pension deductions and any student loan repayment.
        </p>

        <h3>Does the calculator include National Insurance?</h3>
        <p>
          The main UK tax calculator includes an employee National Insurance estimate for common salary cases.
        </p>

        <h3>Why has my tax code changed?</h3>
        <p>
          HMRC may change your tax code because of benefits, underpaid tax, multiple employments, estimated income or other adjustments.
        </p>

        <h3>Do bonuses increase tax?</h3>
        <p>
          Bonuses are taxable as employment income and may increase income tax, National Insurance and student loan deductions.
        </p>

        <div style={{ marginTop: "35px", padding: "24px", background: "#f8fafc", borderRadius: "14px" }}>
          <h3>Related tools and guides</h3>
          <ul>
            <li><a href="https://www.uktaxcalculator.co.uk/#calculator">UK Tax Calculator</a></li>
            <li><a href="/self-assessment-calculator">Self Assessment Calculator</a></li>
            <li><a href="/dividend-tax-calculator">Dividend Tax Calculator</a></li>
            <li><a href="/company-formation">Company Formation Enquiry</a></li>
            <li><a href="/vat-registration">VAT Registration Guide</a></li>
          </ul>
        </div>

        <p style={{ marginTop: "35px", fontSize: "14px", color: "#64748b" }}>
          This page is for general information only and does not constitute tax advice or payroll advice. Final payroll and tax figures depend on your exact tax code, payroll setup and personal circumstances.
        </p>
      </main>
    </div>
  );
}
