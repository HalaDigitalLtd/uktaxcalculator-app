export default function HalaPage() {
  return (
    <div style={{ fontFamily: "sans-serif" }}>

      {/* HERO */}
      <section style={{ padding: "80px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Hala Digital
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "700px", margin: "0 auto" }}>
          We build digital tools, websites and lead generation systems for UK accountants and small businesses.
        </p>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://www.uktaxcalculator.co.uk"
            style={{
              padding: "12px 20px",
              background: "#0070f3",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              margin: "10px"
            }}
          >
            View Our Tax Calculator
          </a>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ padding: "60px 20px", background: "#f9f9f9" }}>
        <h2 style={{ textAlign: "center", marginBottom: "40px" }}>
          What We Do
        </h2>

        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <ul style={{ lineHeight: "2" }}>
            <li>Website development for accountants and small businesses</li>
            <li>SEO and lead generation systems</li>
            <li>Tax and VAT calculators</li>
            <li>Automation and client capture tools</li>
            <li>White-label tools for accounting firms</li>
          </ul>
        </div>
      </section>

      {/* TOOLS */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Our Tools</h2>

        <p style={{ marginTop: "10px" }}>
          Practical tools designed to bring real clients to your business.
        </p>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://www.uktaxcalculator.co.uk"
            style={{
              padding: "12px 20px",
              background: "#111",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            UK Tax Calculator
          </a>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#111", color: "white" }}>
        <h2>Want more clients for your business?</h2>

        <p style={{ marginTop: "10px" }}>
          We help accountants and businesses generate leads using smart tools and websites.
        </p>

        <div style={{ marginTop: "20px" }}>
          <a
            href="mailto:ikramzaman@gmail.com"
            style={{
              padding: "12px 20px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            Contact Us
          </a>
        </div>
      </section>

    </div>
  );
}
