export default function HalaPage() {
  return (
    <div style={{ fontFamily: "sans-serif", lineHeight: 1.6 }}>

      {/* HERO */}
      <section style={{ padding: "80px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          Grow Your Accounting Firm 🚀
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "700px", margin: "0 auto" }}>
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
              background: "#0070f3",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none"
            }}
          >
            Try Free Tax Tool
          </a>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ padding: "60px 20px", background: "#f9f9f9" }}>
        <h2 style={{ textAlign: "center", marginBottom: "40px" }}>
          What We Do
        </h2>

        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p>✔ High-converting websites for accountants</p>
          <p>✔ SEO & Google ranking services</p>
          <p>✔ Lead generation funnels</p>
          <p>✔ Custom tax & VAT tools</p>
        </div>
      </section>
      {/* OFFER */}
<section style={{ padding: "60px 20px", background: "#eef6ff", textAlign: "center" }}>
  <h2>Launch Your Accounting Website from £299</h2>

  <p style={{ marginTop: "10px" }}>
    Fully designed website + lead system + WhatsApp integration.
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
    Claim This Offer
  </a>
</section>
      {/* TRUST */}
<section style={{ padding: "60px 20px", textAlign: "center" }}>
  <h2>Why Work With Hala Digital?</h2>

  <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "20px" }}>
    <p>✅ Built with real UK accountancy practice experience</p>
    <p>✅ Focused on leads, not just design</p>
    <p>✅ Tools and websites designed around accountant-client conversion</p>
    <p>✅ Simple monthly support available after launch</p>
  </div>
</section>
      {/* PACKAGES */}
<section style={{ padding: "60px 20px", background: "#f9f9f9", textAlign: "center" }}>
  <h2>Simple Packages</h2>

  <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "20px" }}>
    <div>
      <h3>Starter Website</h3>
      <p>From £299 setup</p>
      <p>One-page website, WhatsApp CTA and contact form.</p>
    </div>

    <div>
      <h3>Growth Website</h3>
      <p>From £599 setup</p>
      <p>Multi-page website, SEO structure, lead capture and analytics setup.</p>
    </div>

    <div>
      <h3>Accountant Tool Package</h3>
      <p>From £49/month</p>
      <p>Client-facing calculators and lead capture tools for your website.</p>
    </div>
  </div>
</section>
      {/* FREE VALUE */}
<section style={{ padding: "60px 20px", textAlign: "center" }}>
  <h2>Try Our Free Tools</h2>

  <p style={{ marginTop: "10px" }}>
    Not ready to buy? Start with our free tax calculator and see how we build high-converting tools.
  </p>

  <a
    href="https://www.uktaxcalculator.co.uk"
    style={{
      display: "inline-block",
      marginTop: "20px",
      padding: "14px 24px",
      background: "#0070f3",
      color: "white",
      borderRadius: "8px",
      textDecoration: "none"
    }}
  >
    Try Free Tax Calculator
  </a>
</section>
      {/* ENQUIRY FORM */}
<section style={{ padding: "60px 20px", background: "#111", color: "white", textAlign: "center" }}>
  <h2>Want a website or digital tool for your business?</h2>

  <p style={{ marginTop: "10px" }}>
    Tell us what you need and we’ll get back to you.
  </p>

  <form
    action="https://formspree.io/f/xbdwlgdv"
    method="POST"
    style={{ maxWidth: "600px", margin: "30px auto", display: "grid", gap: "12px" }}
  >
    <input type="hidden" name="_subject" value="New Hala Digital Enquiry" />

    <input name="name" placeholder="Your name" required style={{ padding: "12px", borderRadius: "8px" }} />

    <input name="email" type="email" placeholder="Email address" required style={{ padding: "12px", borderRadius: "8px" }} />

    <input name="phone" placeholder="Phone / WhatsApp" required style={{ padding: "12px", borderRadius: "8px" }} />

    <select name="service" required style={{ padding: "12px", borderRadius: "8px" }}>
      <option value="">What do you need?</option>
      <option>Website</option>
      <option>SEO</option>
      <option>Tax / VAT Tool</option>
      <option>Automation</option>
      <option>Not sure yet</option>
    </select>

    <textarea name="message" placeholder="Tell us briefly what you need" rows={4} required style={{ padding: "12px", borderRadius: "8px" }} />

    <button type="submit" style={{ padding: "14px", borderRadius: "8px", background: "#25D366", color: "white", border: "none", fontWeight: "bold" }}>
      Send enquiry
    </button>
  </form>
</section>

      {/* CTA */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Want more clients every month?</h2>

        <p style={{ marginTop: "10px" }}>
          We help accountants generate consistent leads using smart digital systems.
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
          Chat on WhatsApp
        </a>
      </section>

    </div>
  );
}
