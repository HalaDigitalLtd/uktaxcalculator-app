export default function SiteFooter() {
  return (
    <footer style={{ background: "#0f172a", color: "white", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1150px", margin: "0 auto" }}>
        <h3 style={{ margin: 0 }}>Hala Digital Ltd</h3>

        <p style={{ color: "#cbd5e1", maxWidth: "650px" }}>
          Websites, SEO, automation and smart business tools for UK small businesses and professional firms.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "20px" }}>
          <a href="/website-design-for-small-business-uk" style={linkStyle}>Website Design</a>
          <a href="/quote" style={linkStyle}>Website Quote</a>
          <a href="/company-formation" style={linkStyle}>Company Formation</a>
          <a href="/vat-sic" style={linkStyle}>VAT SIC Tool</a>
          <a href="https://www.uktaxcalculator.co.uk" style={linkStyle}>UK Tax Calculator</a>
        </div>

        <p style={{ marginTop: "25px", fontSize: "13px", color: "#94a3b8" }}>
          © {new Date().getFullYear()} Hala Digital Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

const linkStyle = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: "bold",
};
