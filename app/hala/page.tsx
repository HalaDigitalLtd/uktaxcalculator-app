export default function HalaPage() {
  return (
    <div style={{ fontFamily: "sans-serif", lineHeight: 1.6 }}>

      {/* HERO */}
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <h1 style={{ fontSize: "44px", marginBottom: "20px" }}>
          Build, Grow and Automate Your Business Online 🚀
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "760px", margin: "0 auto", opacity: 0.9 }}>
          We build modern websites, SEO systems, automation workflows and smart business tools for UK small businesses and professional firms.
        </p>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20Hala%20Digital%20services.%20Can%20you%20please%20guide%20me?"
            style={{
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              marginRight: "10px"
            }}
             >
    Get Instant Website Quote
  </a>

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
            Start a Project
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
            View UK Tax Calculator
          </a>
        </div>
      </section>
      <p style={{ marginTop: "10px", fontSize: "16px", opacity: 0.8 }}>
  Websites from £299 • Tools from £49/month • Free consultation
</p>

      {/* SERVICES */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>What We Do</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "15px" }}>
          <p>✔ Website design for small businesses and professional firms</p>
          <p>✔ SEO and Google ranking services</p>
          <p>✔ Lead generation funnels and enquiry systems</p>
          <p>✔ Custom calculators, tax tools and automation workflows</p>
        </div>
      </section>

      {/* OFFER */}
      <section style={{ padding: "60px 20px", background: "#eef6ff", textAlign: "center" }}>
        <h2>Launch Your Business Website from £299</h2>

        <p style={{ marginTop: "10px" }}>
          Website + lead system + WhatsApp integration.
        </p>

        <p style={{ marginTop: "10px", fontWeight: "bold" }}>
          Limited time: First 5 clients only
        </p>

        <a
          href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20would%20like%20to%20claim%20the%20website%20offer%20from%20%C2%A3299."
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
        <h2>Why Work With Hala Digital?</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "15px" }}>
          <p>✅ Built with practical UK business and accountancy experience</p>
          <p>✅ Focused on leads, not just design</p>
          <p>✅ Websites and tools designed around real client conversion</p>
          <p>✅ Simple support available after launch</p>
        </div>
      </section>

      {/* PACKAGES */}
      <section style={{ padding: "60px 20px", background: "#f9f9f9", textAlign: "center" }}>
        <h2>Simple Packages</h2>

        <div style={{ maxWidth: "900px", margin: "30px auto", display: "grid", gap: "25px" }}>
          <div>
            <h3>Starter Website</h3>
            <p><strong>From £299</strong></p>
            <p>One-page website with WhatsApp CTA and enquiry form.</p>
          </div>

          <div>
            <h3>Growth Website + SEO</h3>
            <p><strong>From £599</strong></p>
            <p>Multi-page website with SEO structure, lead capture and analytics setup.</p>
          </div>

          <div>
            <h3>Business Tools Package</h3>
            <p><strong>From £49/month</strong></p>
            <p>Tax calculators, CIS tools, corporation tax tools and lead capture widgets.</p>
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section style={{ padding: "60px 20px", textAlign: "center" }}>
        <h2>Explore Our Business Tools</h2>

        <p style={{ maxWidth: "700px", margin: "10px auto" }}>
          We are building practical tools for tax, VAT, CIS, corporation tax and client lead generation.
        </p>

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
          View UK Tax Calculator
        </a>
      </section>

      {/* FORM */}
      <section style={{ padding: "60px 20px", background: "#111", color: "white", textAlign: "center" }}>
        <h2>Start Your Project</h2>

        <p style={{ marginTop: "10px" }}>
          Tell us what you need and we’ll get back to you.
        </p>

        <form
          action="https://formspree.io/f/xbdwlgdv"
          method="POST"
          style={{ maxWidth: "500px", margin: "30px auto", display: "grid", gap: "10px" }}
        >
          <input type="hidden" name="_subject" value="New Hala Digital Enquiry" />

          <input name="name" placeholder="Name" required style={{ padding: "12px", borderRadius: "6px" }} />
          <input name="email" type="email" placeholder="Email" required style={{ padding: "12px", borderRadius: "6px" }} />
          <input name="phone" placeholder="Phone / WhatsApp" required style={{ padding: "12px", borderRadius: "6px" }} />

          <select name="service" required style={{ padding: "12px", borderRadius: "6px" }}>
            <option value="">What do you need?</option>
            <option>Website</option>
            <option>SEO</option>
            <option>Tax / VAT Tool</option>
            <option>Automation</option>
            <option>Not sure yet</option>
          </select>

          <textarea
            name="message"
            placeholder="Tell us briefly what you need"
            rows={4}
            required
            style={{ padding: "12px", borderRadius: "6px" }}
          />

          <button
            type="submit"
            style={{ padding: "14px", background: "#25D366", color: "white", borderRadius: "6px", border: "none", fontWeight: "bold" }}
          >
            Send enquiry
          </button>
        </form>
      </section>

    </div>
  );
}
