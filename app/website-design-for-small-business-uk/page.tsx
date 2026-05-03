export default function WebsiteDesignPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.7, color: "#0f172a" }}>
      <section style={{ padding: "85px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>Hala Digital Ltd</p>

        <h1 style={{ fontSize: "44px", marginBottom: "20px" }}>
          Website Design for UK Small Businesses
        </h1>

        <p style={{ maxWidth: "780px", margin: "0 auto", fontSize: "20px", opacity: 0.9 }}>
          We build fast, modern websites designed to bring enquiries through WhatsApp, forms and Google search.
        </p>

        <p style={{ marginTop: "14px", fontSize: "17px", opacity: 0.9 }}>
          Business websites from £299 • Lead capture included • SEO-ready structure
        </p>

        <div style={{ marginTop: "28px" }}>
          <a
            href="/quote"
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#f59e0b",
              color: "white",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
              margin: "8px",
            }}
          >
            Get Instant Website Quote
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20a%20website%20for%20my%20business."
            style={{
              display: "inline-block",
              padding: "14px 24px",
              background: "#25D366",
              color: "white",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "bold",
              margin: "8px",
            }}
          >
            Chat on WhatsApp
          </a>
        </div>
      </section>

      <main style={{ maxWidth: "1050px", margin: "0 auto", padding: "60px 20px" }}>
        <h2>Websites built to generate leads, not just look nice</h2>
        <p>
          A good website should clearly explain what you do, build trust quickly and make it easy for visitors to contact you.
          Hala Digital builds websites for small businesses, service providers and professional firms that need more enquiries online.
        </p>

        <section style={{ marginTop: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "18px" }}>
          {[
            ["Lead-focused design", "Clear calls to action, WhatsApp buttons and enquiry forms."],
            ["SEO-ready pages", "Structured pages built around the services your customers search for."],
            ["Fast custom build", "Modern website setup using Next.js and Vercel, not heavy WordPress plugins."],
            ["Ongoing support", "Help available after launch for updates, SEO and new pages."]
          ].map(([title, text]) => (
            <div key={title} style={{ padding: "24px", background: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <h3>{title}</h3>
              <p style={{ color: "#475569" }}>{text}</p>
            </div>
          ))}
        </section>

        <section style={{ marginTop: "55px" }}>
          <h2>Simple website packages</h2>

          <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
            <div style={cardStyle}>
              <h3>Starter Website</h3>
              <p style={priceStyle}>From £299</p>
              <p>One-page business website with contact form and WhatsApp CTA.</p>
            </div>

            <div style={cardStyle}>
              <h3>Growth Website</h3>
              <p style={priceStyle}>From £599</p>
              <p>Multi-page website with SEO structure, lead capture and analytics setup.</p>
            </div>

            <div style={cardStyle}>
              <h3>SEO + Website Support</h3>
              <p style={priceStyle}>Monthly support</p>
              <p>Ongoing updates, new pages, SEO improvements and conversion support.</p>
            </div>
          </div>
        </section>

        <section style={{ marginTop: "55px", padding: "30px", background: "#eef6ff", borderRadius: "16px", textAlign: "center" }}>
          <h2>Get your website estimate instantly</h2>
          <p style={{ maxWidth: "700px", margin: "10px auto" }}>
            Use our quote calculator to estimate your website cost based on pages, SEO and lead capture requirements.
          </p>

          <a
            href="/quote"
            style={{
              display: "inline-block",
              marginTop: "14px",
              padding: "12px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Open Website Quote Calculator →
          </a>
        </section>

        <section style={{ marginTop: "55px" }}>
          <h2>Who we build websites for</h2>
          <ul>
            <li>Small businesses and local service providers</li>
            <li>Accountants, consultants and professional firms</li>
            <li>Trades, property businesses and contractors</li>
            <li>Startups, side hustles and newly formed limited companies</li>
          </ul>
        </section>

        <section style={{ marginTop: "55px", padding: "30px", background: "#f0fdf4", borderRadius: "16px", textAlign: "center" }}>
          <h2>Ready to start?</h2>
          <p style={{ maxWidth: "700px", margin: "10px auto" }}>
            Send us a message and we’ll guide you on the best website setup for your business.
          </p>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20need%20a%20website%20for%20my%20business."
            style={{
              display: "inline-block",
              marginTop: "14px",
              padding: "12px 20px",
              background: "#25D366",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Start on WhatsApp →
          </a>
        </section>

        <section style={{ marginTop: "55px" }}>
          <h2>Website design FAQs</h2>

          <h3>Is this WordPress?</h3>
          <p>
            No. We build modern custom websites using Next.js and Vercel, designed for speed, SEO and future tools.
          </p>

          <h3>Can you build a simple business website?</h3>
          <p>
            Yes. Starter websites are suitable for businesses that need a clean online presence, contact form and WhatsApp enquiry flow.
          </p>

          <h3>Can you help with SEO?</h3>
          <p>
            Yes. We can structure pages around search terms and help build content for long-term Google visibility.
          </p>

          <h3>Can you add calculators or tools?</h3>
          <p>
            Yes. Hala Digital can build lead-generating tools such as quote calculators, tax calculators and industry-specific checkers.
          </p>
        </section>
        <div style={{ marginTop: "40px" }}>
  <h3>Related guides</h3>
  <ul>
    <li><a href="/small-business-website-cost-uk">Small Business Website Cost UK</a></li>
    <li><a href="/accountant-website-design-uk">Website Design for Accountants</a></li>
  </ul>
</div>

        <div style={{ marginTop: "35px", padding: "24px", background: "#f8fafc", borderRadius: "14px" }}>
          <h3>Related services and tools</h3>
          <ul>
            <li><a href="/quote">Website Quote Calculator</a></li>
            <li><a href="/company-formation">Company Formation Enquiry</a></li>
            <li><a href="/self-assessment-calculator">Self Assessment Calculator</a></li>
            <li><a href="/vat-sic">VAT SIC Code Tool</a></li>
          </ul>
        </div>

        <p style={{ marginTop: "35px", fontSize: "14px", color: "#64748b" }}>
          Pricing depends on requirements, content, integrations and ongoing support. Final quotation will be confirmed after review.
        </p>
      </main>
    </div>
  );
}

const cardStyle = {
  padding: "26px",
  borderRadius: "16px",
  background: "white",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15,23,42,0.06)",
};

const priceStyle = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#2563eb",
};

