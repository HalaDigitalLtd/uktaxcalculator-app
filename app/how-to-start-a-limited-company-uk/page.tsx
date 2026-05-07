export default function StartLtdPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#0f172a" }}>
      
      {/* HERO */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <h1>How to Start a Limited Company in the UK</h1>
        <p style={{ maxWidth: "700px", margin: "10px auto" }}>
          A simple step-by-step guide to setting up your UK limited company and staying compliant with Companies House and HMRC.
        </p>

        <a
          href="/company-formation"
          style={{
            display: "inline-block",
            marginTop: "20px",
            padding: "14px 24px",
            background: "#25D366",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none"
          }}
        >
          Start Your Company Now →
        </a>
      </section>

      {/* CONTENT */}
      <section style={{ padding: "60px 20px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          <h2>1. Choose your company name</h2>
          <p>Your company name must be unique and not already registered with Companies House.</p>

          <h2>2. Appoint directors and shareholders</h2>
          <p>You need at least one director. Shareholders own the company.</p>

          <h2>3. Decide share structure</h2>
          <p>Most companies start with 1 share per owner, but this can vary.</p>

          <h2>4. Register with Companies House</h2>
          <p>This officially creates your company. You will receive a certificate of incorporation.</p>

          <h2>5. Set up for tax</h2>
          <p>You must register for Corporation Tax and may need VAT or PAYE depending on your setup.</p>

          <h2>6. Open a business bank account</h2>
          <p>This keeps your company finances separate from personal finances.</p>

          <h2>7. Stay compliant</h2>
          <p>You must file annual accounts, confirmation statement and tax returns.</p>

          {/* CTA */}
          <div style={{
            marginTop: "40px",
            padding: "25px",
            background: "#eef6ff",
            borderRadius: "10px",
            textAlign: "center"
          }}>
            <h3>Need help setting up your company?</h3>

            <p style={{ marginTop: "10px" }}>
              Avoid mistakes and get your company set up correctly with accountant support.
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
              Get Company Formation Help →
            </a>
          </div>

        </div>
      </section>
    </div>
  );
}
