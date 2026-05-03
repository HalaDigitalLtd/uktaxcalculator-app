export default function ClientOnboardingToolPage() {
  const buttonStyle = {
    display: "inline-block",
    padding: "14px 24px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: "bold",
    margin: "8px"
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>

      {/* HERO */}
      <section style={{ padding: "90px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Stop Chasing Clients for Documents
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "750px", margin: "0 auto", opacity: 0.9 }}>
          Send one link. Your clients upload everything in one go. Get a clean, structured file pack instantly.
        </p>

        <p style={{ marginTop: "12px", opacity: 0.8 }}>
          Built for UK accountants and small practices
        </p>

        <div style={{ marginTop: "30px" }}>
          <a href="/client-upload" style={{ ...buttonStyle, background: "#25D366", color: "white" }}>
            Try Demo Upload
          </a>

          <a href="#pricing" style={{ ...buttonStyle, background: "#f59e0b", color: "white" }}>
            View Pricing
          </a>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: "70px 20px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2>Still chasing clients on WhatsApp and email?</h2>

          <ul style={{ marginTop: "20px", lineHeight: 2 }}>
            <li>❌ Missing bank statements</li>
            <li>❌ Incomplete information</li>
            <li>❌ Multiple follow-ups</li>
            <li>❌ Delayed year-end work</li>
          </ul>
        </div>
      </section>

      {/* SOLUTION */}
      <section style={{ padding: "70px 20px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2>Simple solution: Send one structured link</h2>

          <p style={{ marginTop: "10px" }}>
            Your client receives a single link where they upload all required information, documents and details.
          </p>

          <ul style={{ marginTop: "20px", lineHeight: 2 }}>
            <li>✅ Business details</li>
            <li>✅ Income & expenses</li>
            <li>✅ Bank statements upload</li>
            <li>✅ Notes & additional info</li>
          </ul>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "70px 20px", background: "#eef6ff" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2>How it works</h2>

          <ol style={{ marginTop: "20px", lineHeight: 2 }}>
            <li>1. You send your client a link</li>
            <li>2. Client fills everything in one go</li>
            <li>3. You receive structured data instantly</li>
            <li>4. Start accounts without chasing</li>
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "70px 20px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2>Key features</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginTop: "30px" }}>
            {[
              "Client document upload",
              "Structured data capture",
              "WhatsApp-friendly flow",
              "Simple accountant dashboard (coming soon)",
              "Secure submission",
              "Works with any website (WordPress or not)"
            ].map((item) => (
              <div key={item} style={{ padding: "20px", background: "#f8fafc", borderRadius: "12px" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "70px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <h2>Simple pricing</h2>

        <p style={{ marginTop: "10px" }}>
          Start free. Upgrade when ready.
        </p>

        <div style={{ marginTop: "30px" }}>
          <h3>£0 Trial</h3>
          <p>Test with real clients</p>

          <h3 style={{ marginTop: "20px" }}>£19/month</h3>
          <p>Full access + ongoing use</p>
        </div>

        <a
          href="https://formspree.io/f/xbdwlgdv"
          style={{ ...buttonStyle, background: "#25D366", color: "white", marginTop: "20px" }}
        >
          Request Access
        </a>
      </section>

      {/* TRUST / GDPR */}
      <section style={{ padding: "50px 20px", textAlign: "center" }}>
        <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "700px", margin: "0 auto" }}>
          All data is transmitted securely. We act as a data processor, and your firm remains the data controller.
          No sensitive data is stored permanently. Files can be deleted upon request.
        </p>
      </section>

    </div>
  );
}
