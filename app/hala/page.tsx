export default function HalaPage() {
  return (
    <div style={{ fontFamily: "sans-serif", lineHeight: 1.6 }}>

      {/* HERO */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <h1 style={{ fontSize: "44px", marginBottom: "20px" }}>
          Grow Your Accounting Firm 🚀
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "700px", margin: "0 auto", opacity: 0.9 }}>
          We build websites, tools and lead generation systems for UK accountants and small businesses.
        </p>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://wa.me/447884063169"
            style={{
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              marginRight: "10px"
            }}
          >
            Get More Clients
          </a>

          <a
            href="https://www.uktaxcalculator.co.uk"
            style={{
              padding: "14px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            Try Free Tool
          </a>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>What We Do</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "15px" }}>
          <p>✔ High-converting websites for accountants</p>
          <p>✔ SEO & Google ranking services</p>
          <p>✔ Lead generation systems</p>
          <p>✔ Custom tax & VAT tools</p>
        </div>
      </section>

      {/* OFFER */}
      <section style={{ padding: "60px 20px", background: "#eef6ff", textAlign: "center" }}>
        <h2>Launch Your Website from £299</h2>

        <p style={{ marginTop: "10px" }}>
          Website + lead system + WhatsApp integration.
        </p>

        <p style={{ marginTop: "10px", fontWeight: "bold" }}>
          Limited time: First 5 clients only
        </p>

        <a
          href="https://wa.me/447884063169"
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
          Claim Offer
        </a>
      </section>

      {/* TRUST */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Why Work With Us?</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "15px" }}>
          <p>✅ Built with real UK accountancy experience</p>
          <p>✅ Focused on leads, not just design</p>
          <p>✅ Conversion-driven systems</p>
          <p>✅ Ongoing support available</p>
        </div>
      </section>

      {/* PACKAGES */}
      <section style={{ padding: "60px 20px", background: "#f9f9f9", textAlign: "center" }}>
        <h2>Simple Packages</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "20px" }}>
          <div>
            <h3>Starter Website</h3>
            <p>From £299</p>
          </div>

          <div>
            <h3>Growth Website</h3>
            <p>From £599</p>
          </div>

          <div>
            <h3>Tools Package</h3>
            <p>From £49/month</p>
          </div>
        </div>
      </section>

      {/* FREE TOOL */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Try Our Free Tool</h2>

        <a
          href="https://www.uktaxcalculator.co.uk"
          style={{
            display: "inline-block",
            marginTop: "20px",
            padding: "14px 24px",
            background: "#2563eb",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none"
          }}
        >
          Open Tax Calculator
        </a>
      </section>

      {/* FORM */}
      <section style={{ padding: "60px 20px", background: "#111", color: "white", textAlign: "center" }}>
        <h2>Start Your Project</h2>

        <form
          action="https://formspree.io/f/xbdwlgdv"
          method="POST"
          style={{ maxWidth: "500px", margin: "30px auto", display: "grid", gap: "10px" }}
        >
          <input name="name" placeholder="Name" required style={{ padding: "12px", borderRadius: "6px" }} />
          <input name="email" placeholder="Email" required style={{ padding: "12px", borderRadius: "6px" }} />
          <input name="phone" placeholder="Phone" required style={{ padding: "12px", borderRadius: "6px" }} />

          <button style={{ padding: "14px", background: "#25D366", color: "white", borderRadius: "6px" }}>
            Send enquiry
          </button>
        </form>
      </section>

    </div>
  );
}
