export default function DividendTaxCalculatorPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>
      
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <h1>Dividend Tax Calculator UK</h1>

        <p style={{ maxWidth: "700px", margin: "10px auto" }}>
          Estimate how much tax you pay on dividends in the UK based on your income and tax band.
        </p>

        <div style={{ marginTop: "25px" }}>
          <a
            href="https://www.uktaxcalculator.co.uk/#calculator"
            style={{
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              marginRight: "10px"
            }}
          >
            Use Dividend Calculator
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20with%20dividend%20tax."
            style={{
              padding: "14px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            Speak to Accountant
          </a>
        </div>
      </section>

      <section style={{ padding: "60px 20px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          <h2>How dividend tax works in the UK</h2>
          <p>
            Dividends are taxed differently from salary. The amount of tax you pay depends on your total income and tax band.
          </p>

          <h2>Dividend tax rates</h2>
          <ul>
            <li>Basic rate: 8.75%</li>
            <li>Higher rate: 33.75%</li>
            <li>Additional rate: 39.35%</li>
          </ul>

          <h2>Dividend allowance</h2>
          <p>
            The first £500 of dividend income is usually tax-free, depending on your overall income.
          </p>

          <h2>Who needs to pay dividend tax?</h2>
          <p>
            Company directors, shareholders and investors receiving dividends may need to report and pay tax through Self Assessment.
          </p>

          <div style={{
            marginTop: "40px",
            padding: "25px",
            background: "#eef6ff",
            borderRadius: "10px",
            textAlign: "center"
          }}>
            <h3>Need help with dividend tax planning?</h3>

            <p style={{ marginTop: "10px" }}>
              Directors can reduce tax with proper salary and dividend planning.
            </p>

            <a
              href="/company-formation"
              style={{
                display: "inline-block",
                marginTop: "15px",
                padding: "12px 20px",
                background: "#2563eb",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none"
              }}
            >
              Get Help →
            </a>
          </div>

          <h2>FAQs</h2>

          <h3>Do I pay tax on all dividends?</h3>
          <p>No, the dividend allowance applies first.</p>

          <h3>Do dividends affect my tax band?</h3>
          <p>Yes, dividends are added to your total income.</p>

          <h3>Do I need to file Self Assessment?</h3>
          <p>Yes, if dividends exceed the allowance or HMRC requires it.</p>

        </div>
      </section>
    </div>
  );
}
