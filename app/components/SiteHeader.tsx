export default function SiteHeader() {
  const linkStyle = {
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "14px",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "white",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          maxWidth: "1150px",
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <a
          href="/hala"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#0f172a",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563eb, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              fontSize: "20px",
            }}
          >
            H
          </div>

          <div>
            <div style={{ fontWeight: "bold", fontSize: "18px" }}>Hala Digital</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Websites • SEO • Smart Tools
            </div>
          </div>
        </a>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <a href="/website-design-for-small-business-uk" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Website Design
          </a>

          <a href="/quote" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Quote
          </a>

          <a href="/company-formation" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Company Formation
          </a>

          <a href="/vat-sic" target="_blank" rel="noopener noreferrer" style={linkStyle}>
            VAT SIC Tool
          </a>

          <a
            href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20Hala%20Digital%20services."
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 16px",
              background: "#25D366",
              color: "white",
              borderRadius: "999px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            WhatsApp
          </a>
        </nav>
      </div>
    </header>
  );
}
