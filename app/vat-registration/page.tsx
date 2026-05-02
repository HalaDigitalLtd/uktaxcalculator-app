export default function VatRegistrationPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>
      <section style={{ padding: "80px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>UK VAT Guide</p>
        <h1 style={{ fontSize: "42px" }}>Do I Need to Register for VAT in the UK?</h1>
        <p style={{ maxWidth: "760px", margin: "15px auto", fontSize: "19px", opacity: 0.9 }}>
          A practical guide for UK businesses to understand VAT registration, taxable turnover, exempt income and when professional review is needed.
        </p>
      </section>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px" }}>
        <h2>When VAT registration is required</h2>
        <p>
          A UK business normally needs to register for VAT when its taxable turnover exceeds the VAT registration threshold in a rolling 12-month period.
          Taxable turnover includes standard-rated, reduced-rated and zero-rated supplies.
        </p>

        <div style={{ padding: "22px", background: "#eef6ff", borderRadius: "14px", margin: "25px 0" }}>
          <h3>Important point</h3>
          <p>
            Exempt income and outside-the-scope income usually do not count towards the VAT registration threshold.
            This is why classifying the business activity correctly is very important.
          </p>
        </div>

        <h2>Common examples</h2>
        <ul>
          <li>Accountants, consultants, web designers and IT businesses are usually standard-rated.</li>
          <li>Residential rent is usually exempt from VAT.</li>
          <li>Food, health, education and property can be complex depending on the exact supply.</li>
          <li>Zero-rated sales still count as taxable turnover for VAT registration purposes.</li>
        </ul>

        <h2>Why SIC code alone is not enough</h2>
        <p>
          SIC codes can help identify the likely business activity, but VAT treatment depends on the actual supply,
          customer type, place of supply, exemptions, special schemes and other VAT rules.
        </p>

        <h2>Use our VAT SIC Code Checker</h2>
        <p>
          We are building a VAT SIC Code Intelligence Tool to help accountants and businesses identify likely VAT treatment,
          risk level and review points by SIC code.
        </p>

        <div style={{ marginTop: "25px" }}>
          <a
            href="/vat-sic"
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              marginRight: "10px"
            }}
          >
            Try VAT SIC Tool
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20help%20checking%20whether%20I%20need%20to%20register%20for%20VAT."
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold"
            }}
          >
            Ask for VAT Review
          </a>
        </div>

        <p style={{ marginTop: "35px", fontSize: "14px", color: "#64748b" }}>
          This page is for general information only and does not constitute tax advice. VAT treatment should be reviewed based on the specific facts.
        </p>
      </main>
    </div>
  );
}
