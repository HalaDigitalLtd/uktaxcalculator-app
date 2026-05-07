export default function VatPropertyPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7 }}>
      <section style={{ padding: "80px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <h1 style={{ fontSize: "42px" }}>VAT on Property in the UK Explained</h1>
        <p style={{ maxWidth: "760px", margin: "15px auto", fontSize: "19px", opacity: 0.9 }}>
          Understand VAT on residential property, commercial property, new builds and conversions with simple practical examples.
        </p>
      </section>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px" }}>
        <h2>Residential property</h2>
        <p>
          Residential rent is normally exempt from VAT. This means you do not charge VAT but also cannot recover input VAT on related costs.
        </p>

        <h2>Commercial property</h2>
        <p>
          Commercial property is normally exempt unless the owner has opted to tax. If opted, VAT is charged at the standard rate.
        </p>

        <h2>New builds and conversions</h2>
        <p>
          New residential builds are often zero-rated, meaning VAT is charged at 0% but input VAT can be reclaimed.
        </p>

        <h2>Common mistakes</h2>
        <ul>
          <li>Assuming all rent is VAT free</li>
          <li>Not understanding option to tax</li>
          <li>Incorrect VAT recovery on costs</li>
        </ul>

        <h2>Need help?</h2>
        <p>
          Property VAT is complex and depends on the specific transaction and structure.
        </p>

        <div style={{ marginTop: "25px" }}>
          <a href="/vat-sic" style={{ padding: "14px 24px", background: "#2563eb", color: "white", borderRadius: "8px", textDecoration: "none", marginRight: "10px" }}>
            Use VAT SIC Tool
          </a>

          <a href="https://wa.me/447884063169" style={{ padding: "14px 24px", background: "#25D366", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            Get Expert Advice
          </a>
        </div>
        <h3>Related tools and guides</h3>

<ul>
  <li><a href="/vat-sic">VAT SIC Code Checker</a></li>
  <li><a href="/vat-registration">VAT Registration Guide</a></li>
</ul>
      </main>
    </div>
  );
}
