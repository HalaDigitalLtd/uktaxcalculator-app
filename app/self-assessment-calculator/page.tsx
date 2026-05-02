export default function SelfAssessmentCalculatorPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>UK Tax Calculator</p>

        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Self Assessment Tax Calculator UK
        </h1>

        <p style={{ maxWidth: "760px", margin: "0 auto", fontSize: "19px", opacity: 0.9 }}>
          Estimate your UK Self Assessment tax for employment income, self-employment profit, rental income, dividends and savings.
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
            Use Calculator
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20with%20my%20Self%20Assessment%20tax%20return."
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
            Get Accountant Review
          </a>
        </div>
      </section>

      <main style={{ maxWidth: "950px", margin: "0 auto", padding: "60px 20px" }}>
        <h2>What this Self Assessment calculator helps with</h2>
        <p>
          This calculator is designed for common UK Self Assessment cases where a person may have employment income,
          sole trader profit, rental profit, dividends, savings interest, student loan repayments or payments on account.
        </p>

        <div style={{ padding: "24px", background: "#eef6ff", borderRadius: "14px", margin: "30px 0" }}>
          <h3>Quick access</h3>
          <p>
            Use our live calculator to estimate your tax, then request a professional review if you are unsure before filing with HMRC.
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

        <h2>Who needs to file a Self Assessment tax return?</h2>
        <p>
          You may need to file a Self Assessment tax return if you are self-employed, receive rental income,
          receive dividends, have untaxed income, are a company director with additional income, or need to report
          capital gains or foreign income.
        </p>

        <h2>Common income types included</h2>
        <ul>
          <li>Employment income and PAYE tax deducted</li>
          <li>Self-employment turnover and allowable expenses</li>
          <li>Rental profit from UK property</li>
          <li>Dividends from limited companies</li>
          <li>Savings interest</li>
          <li>Pension contributions and Gift Aid</li>
          <li>Student loan repayment estimate</li>
        </ul>

        <h2>When should you get accountant review?</h2>
        <p>
          You should consider professional review if you have mixed income, dividends, property income, payments on account,
          student loans, income over £100,000, VAT registration risk, capital gains, foreign income or residence issues.
        </p>

        <div style={{ marginTop: "40px", padding: "28px", background: "#f0fdf4", borderRadius: "14px", textAlign: "center" }}>
          <h3>Need your Self Assessment checked?</h3>
          <p style={{ maxWidth: "680px", margin: "10px auto" }}>
            Avoid overpaying tax or making costly mistakes. Get your figures reviewed by a UK accountant before submitting to HMRC.
          </p>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20with%20my%20Self%20Assessment%20tax%20return."
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
            Ask for Self Assessment Help →
          </a>
        </div>

        <h2>Self Assessment FAQs</h2>

        <h3>What is Self Assessment?</h3>
        <p>
          Self Assessment is the system used by HMRC to collect tax from people and businesses where tax has not been fully collected through PAYE.
        </p>

        <h3>Can I calculate my Self Assessment tax online?</h3>
        <p>
          Yes. A calculator can give an estimate, but final figures should be checked carefully before submission.
        </p>

        <h3>Do dividends go on a Self Assessment tax return?</h3>
        <p>
          Dividends may need to be reported depending on the amount received and your overall tax position.
        </p>

        <h3>Do landlords need to file Self Assessment?</h3>
        <p>
          Landlords usually need to report rental income and expenses through Self Assessment unless HMRC confirms otherwise.
        </p>

        <h3>What happens if I file late?</h3>
        <p>
          Late filing can lead to penalties and interest, so it is important to prepare early and keep accurate records.
        </p>

        <div style={{ marginTop: "35px", padding: "24px", background: "#f8fafc", borderRadius: "14px" }}>
          <h3>Related tools and guides</h3>
          <ul>
            <li><a href="https://www.uktaxcalculator.co.uk/#calculator">UK Tax Calculator</a></li>
            <li><a href="/vat-registration">VAT Registration Guide</a></li>
            <li><a href="/vat-sic">VAT SIC Code Checker</a></li>
            <li><a href="/company-formation">Company Formation Enquiry</a></li>
            <li><a href="/how-to-start-a-limited-company-uk">How to Start a Limited Company</a></li>
          </ul>
        </div>

        <p style={{ marginTop: "35px", fontSize: "14px", color: "#64748b" }}>
          This page is for general information only and does not constitute tax advice. Final tax figures should be reviewed based on your specific circumstances.
        </p>
      </main>
    </div>
  );
}
