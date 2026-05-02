export default function HalaPage() {
  const buttonStyle = {
    display: "inline-block",
    padding: "14px 24px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: "bold",
    margin: "8px"
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#0f172a" }}>
      
      {/* HERO */}
      <section style={{ padding: "90px 20px", textAlign: "center", background: "linear-gradient(135deg, #0f172a, #1e3a8a)", color: "white" }}>
        <p style={{ fontWeight: "bold", color: "#93c5fd" }}>
          Hala Digital Ltd
        </p>

        <h1 style={{ fontSize: "46px", marginBottom: "20px" }}>
          Websites, SEO & Smart Business Tools
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "780px", margin: "0 auto", opacity: 0.92 }}>
          We help UK small businesses and professional firms build better websites, generate more leads and use smart tools to grow online.
        </p>

        <p style={{ marginTop: "14px", fontSize: "16px", opacity: 0.85 }}>
          Websites from £299 • Tools from £49/month • Free consultation
        </p>

        <div style={{ marginTop: "30px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
          <a href="/quote" style={{ ...buttonStyle, background: "#f59e0b", color: "white" }}>
            Get Instant Website Quote
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20Hala%20Digital%20services.%20Can%20you%20please%20guide%20me?"
            style={{ ...buttonStyle, background: "#25D366", color: "white" }}
          >
            Start a Project
          </a>

          <a href="https://www.uktaxcalculator.co.uk" style={{ ...buttonStyle, background: "#2563eb", color: "white" }}>
            View Tax Calculator
          </a>
          <a
  href="/vat-sic"
  style={{ ...buttonStyle, background: "#0f172a", color: "white" }}
>
  Try VAT SIC Tool
</a>
          <a
  href="/company-formation"
  style={{ ...buttonStyle, background: "#9333ea", color: "white" }}
>
  Start a Limited Company
</a>
        </div>
      </section>
      <p style={{ marginTop: "30px", fontSize: "14px", color: "#94a3b8" }}>
  Website design UK • SEO services UK • Small business websites • Accountant website design • Business automation tools UK
</p>

      {/* SERVICES */}
      <section style={{ padding: "70px 20px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "34px" }}>What We Do</h2>
          <p style={{ maxWidth: "720px", margin: "10px auto 35px", color: "#475569" }}>
            Practical digital services designed to bring enquiries, leads and measurable business value.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "20px" }}>
            {[
              ["Website Design", "Modern websites for small businesses, accountants and professional firms."],
              ["SEO & Google Ranking", "SEO structure, content planning and ranking strategy to attract organic traffic."],
              ["Lead Generation Funnels", "Forms, WhatsApp CTAs and conversion-focused pages that capture enquiries."],
              ["Business Tools", "Custom calculators, tax tools, VAT tools, CIS tools and automation workflows."]
            ].map(([title, text]) => (
              <div key={title} style={{ background: "white", padding: "26px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
                <h3>{title}</h3>
                <p style={{ color: "#475569" }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "30px" }}>
  <a
    href="/company-formation"
    style={{
      display: "inline-block",
      padding: "14px 24px",
      background: "#0f172a",
      color: "white",
      borderRadius: "10px",
      textDecoration: "none",
      fontWeight: "bold"
    }}
  >
    Start a UK Limited Company →
  </a>
</div>
        </div>
      </section>
      {/* PORTFOLIO */}
<section style={{ padding: "70px 20px", background: "#ffffff", textAlign: "center" }}>
  <h2 style={{ fontSize: "34px" }}>Example Work</h2>

  <p style={{ maxWidth: "700px", margin: "10px auto 30px", color: "#475569" }}>
    Simple, clean and conversion-focused websites and tools built for real businesses.
  </p>

  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    maxWidth: "1000px",
    margin: "0 auto"
  }}>
    
    <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
      <h3>UK Tax Calculator</h3>
      <p>High-converting tax calculator with lead capture and WhatsApp funnel.</p>
      <a href="https://www.uktaxcalculator.co.uk" style={{ color: "#2563eb" }}>
        View Project →
      </a>
    </div>

    <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
      <h3>Lead Capture Website</h3>
      <p>Business website with enquiry forms, WhatsApp and conversion-focused design.</p>
      <span style={{ color: "#64748b" }}>
        Built for service-based businesses
      </span>
    </div>

    <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
      <h3>Quote Calculator</h3>
      <p>Interactive pricing tool to generate high-quality leads automatically.</p>
      <a href="/quote" style={{ color: "#2563eb" }}>
        Try Tool →
      </a>
    </div>

  </div>
</section>

      {/* OFFER */}
      <section style={{ padding: "70px 20px", textAlign: "center", background: "#eef6ff" }}>
        <h2 style={{ fontSize: "32px" }}>Launch Your Business Website from £299</h2>
        <p style={{ marginTop: "10px", color: "#334155" }}>
          Website + enquiry form + WhatsApp integration + basic launch support.
        </p>
        <p style={{ marginTop: "10px", fontWeight: "bold" }}>
          Limited time: First 5 clients only
        </p>

        <a
          href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20would%20like%20to%20claim%20the%20website%20offer%20from%20%C2%A3299."
          style={{ ...buttonStyle, background: "#25D366", color: "white", marginTop: "20px" }}
        >
          Claim Offer
        </a>
      </section>

      {/* PACKAGES */}
      <section style={{ padding: "70px 20px", background: "white" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "34px" }}>Simple Packages</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginTop: "35px" }}>
            {[
              ["Starter Website", "From £299", "One-page website with WhatsApp CTA and enquiry form."],
              ["Growth Website + SEO", "From £599", "Multi-page website with SEO structure, lead capture and analytics setup."],
              ["Business Tools Package", "From £49/month", "Tax calculators, CIS tools, corporation tax tools and lead capture widgets."]
            ].map(([title, price, text]) => (
              <div key={title} style={{ border: "1px solid #e2e8f0", padding: "28px", borderRadius: "18px", boxShadow: "0 8px 25px rgba(15,23,42,0.06)" }}>
                <h3>{title}</h3>
                <p style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb" }}>{price}</p>
                <p style={{ color: "#475569" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section style={{ padding: "70px 20px", textAlign: "center", background: "#f8fafc" }}>
        <h2 style={{ fontSize: "34px" }}>Explore Our Business Tools</h2>
        <p style={{ maxWidth: "720px", margin: "10px auto 25px", color: "#475569" }}>
          We are building practical tools for tax, VAT, CIS, corporation tax, pricing and client lead generation.
        </p>

        <a href="https://www.uktaxcalculator.co.uk" style={{ ...buttonStyle, background: "#2563eb", color: "white" }}>
          View UK Tax Calculator
        </a>

        <a href="/quote" style={{ ...buttonStyle, background: "#f59e0b", color: "white" }}>
          Get Website Quote
        </a>
      </section>

      {/* TRUST */}
      <section style={{ padding: "70px 20px", background: "white", textAlign: "center" }}>
        <h2 style={{ fontSize: "34px" }}>Why Work With Hala Digital?</h2>

        <div style={{ maxWidth: "850px", margin: "30px auto", display: "grid", gap: "14px", color: "#334155" }}>
          <p>✅ Built with practical UK business and accountancy experience</p>
          <p>✅ Focused on leads, not just design</p>
          <p>✅ Websites and tools designed around real client conversion</p>
          <p>✅ Simple support available after launch</p>
        </div>
      </section>

      {/* FORM */}
      <section style={{ padding: "70px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <h2 style={{ fontSize: "34px" }}>Start Your Project</h2>
        <p style={{ marginTop: "10px", opacity: 0.85 }}>
          Tell us what you need and we’ll get back to you.
        </p>

        <form
          action="https://formspree.io/f/xbdwlgdv"
          method="POST"
          style={{ maxWidth: "520px", margin: "30px auto", display: "grid", gap: "12px" }}
        >
          <input type="hidden" name="_subject" value="New Hala Digital Enquiry" />

          <input name="name" placeholder="Name" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />
          <input name="email" type="email" placeholder="Email" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />
          <input name="phone" placeholder="Phone / WhatsApp" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />

          <select name="service" required style={{ padding: "14px", borderRadius: "8px", border: "none" }}>
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
            style={{ padding: "14px", borderRadius: "8px", border: "none" }}
          />

          <button
            type="submit"
            style={{
              padding: "15px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Send enquiry
          </button>
        </form>
      </section>
      <section style={{ padding: "50px 20px", textAlign: "center" }}>
  <h2>Free VAT and Tax Resources</h2>

  <div style={{ marginTop: "20px" }}>
    <a href="/vat-registration" style={{ marginRight: "10px" }}>
      VAT Registration Guide
    </a>
    <a href="/vat-property" style={{ marginRight: "10px" }}>
      VAT on Property
    </a>
    <a href="/vat-sic">
      VAT SIC Tool
    </a>
  </div>
</section>

      {/* FLOATING WHATSAPP */}
      <a
        href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20Hala%20Digital%20services."
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          padding: "12px 18px",
          background: "#25D366",
          color: "white",
          borderRadius: "999px",
          textDecoration: "none",
          fontWeight: "bold",
          boxShadow: "0 8px 25px rgba(0,0,0,0.25)"
        }}
      >
        WhatsApp
      </a>

    </div>
  );
}
