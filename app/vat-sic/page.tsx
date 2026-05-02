"use client";

import { useMemo, useState } from "react";

const sampleData = [
  {
    sic: "69201",
    activity: "Accounting and auditing activities",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Accounting, bookkeeping and tax services are normally standard-rated.",
  },
  {
    sic: "68209",
    activity: "Other letting and operating of own or leased real estate",
    treatment: "Likely Exempt / Complex",
    rate: "Exempt unless opted to tax",
    risk: "High",
    preview: "Residential letting is usually exempt. Commercial property may change if option to tax applies.",
  },
  {
    sic: "56101",
    activity: "Licensed restaurants",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Restaurant meals, hot food and drinks are normally standard-rated.",
  },
  {
    sic: "86900",
    activity: "Other human health activities",
    treatment: "Likely Exempt / Mixed",
    rate: "Depends on service and provider status",
    risk: "High",
    preview: "Medical treatment by regulated professionals may be exempt, but cosmetic or non-medical services may be taxable.",
  },
  {
    sic: "62012",
    activity: "Business and domestic software development",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "UK software development and IT services are normally standard-rated.",
  },
];

export default function VatSicPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return sampleData;

    return sampleData.filter(
      (item) =>
        item.sic.includes(q) ||
        item.activity.toLowerCase().includes(q) ||
        item.treatment.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#0f172a" }}>
      <section
        style={{
          padding: "80px 20px",
          textAlign: "center",
          background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
          color: "white",
        }}
      >
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>
          Hala Digital VAT Tool
        </p>

        <h1 style={{ fontSize: "44px", marginBottom: "20px" }}>
          VAT SIC Code Intelligence Checker
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "820px", margin: "0 auto", opacity: 0.9 }}>
          Search a UK SIC code and get an indicative VAT treatment, risk flag and accountant review prompt.
        </p>

        <p style={{ marginTop: "14px", fontSize: "15px", opacity: 0.85 }}>
          Built for accountants, bookkeepers and VAT review workflows.
        </p>
      </section>

      <section style={{ padding: "60px 20px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "950px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "32px" }}>
            Free Preview Search
          </h2>

          <p style={{ textAlign: "center", color: "#475569", maxWidth: "720px", margin: "10px auto 30px" }}>
            This preview shows a limited sample only. The full tool will include detailed VAT treatment,
            risk scoring, HMRC reference notes, client questions and review flags.
          </p>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SIC code or activity e.g. 69201, property, software"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "16px",
              marginBottom: "25px",
            }}
          />

          <div style={{ display: "grid", gap: "18px" }}>
            {results.map((item) => (
              <div
                key={item.sic}
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "16px",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      SIC {item.sic} — {item.activity}
                    </h3>
                    <p style={{ color: "#475569", marginTop: "8px" }}>{item.preview}</p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontWeight: "bold", color: "#2563eb" }}>{item.treatment}</p>
                    <p style={{ margin: "4px 0", color: "#334155" }}>{item.rate}</p>
                    <p
                      style={{
                        display: "inline-block",
                        margin: 0,
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: item.risk === "High" ? "#fee2e2" : "#dcfce7",
                        color: item.risk === "High" ? "#991b1b" : "#166534",
                        fontWeight: "bold",
                        fontSize: "13px",
                      }}
                    >
                      {item.risk} Risk
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "16px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    color: "#475569",
                  }}
                >
                  🔒 Full analysis locked: HMRC references, client questions, partial exemption flags,
                  DRC/margin scheme checks and detailed practitioner notes.
                </div>
              </div>
            ))}
          </div>

          {results.length === 0 ? (
            <div style={{ marginTop: "25px", padding: "20px", background: "white", borderRadius: "14px", textAlign: "center" }}>
              <strong>No preview result found.</strong>
              <p>Request access to the full SIC/VAT database for wider coverage.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ padding: "70px 20px", textAlign: "center", background: "#eef6ff" }}>
        <h2 style={{ fontSize: "34px" }}>Unlock the Full VAT SIC Database</h2>

        <p style={{ maxWidth: "760px", margin: "10px auto", color: "#334155" }}>
          The full version is designed for accounting practices and VAT review work. It will help identify
          likely VAT treatment, registration risk, exempt/mixed supplies and areas requiring specialist review.
        </p>

        <div style={{ maxWidth: "900px", margin: "35px auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
          {[
            "707+ SIC code reference",
            "VAT treatment categories",
            "Risk scoring",
            "Practitioner notes",
            "HMRC reference prompts",
            "Client review questions",
          ].map((text) => (
            <div key={text} style={{ background: "white", padding: "20px", borderRadius: "14px", boxShadow: "0 8px 25px rgba(15,23,42,0.06)" }}>
              ✅ {text}
            </div>
          ))}
        </div>

        <a
          href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20the%20VAT%20SIC%20Code%20Intelligence%20Tool."
          style={{
            display: "inline-block",
            padding: "14px 24px",
            background: "#25D366",
            color: "white",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Request Early Access
        </a>
      </section>

      <section style={{ padding: "70px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <h2 style={{ fontSize: "34px" }}>Join the Early Access List</h2>

        <p style={{ maxWidth: "720px", margin: "10px auto", opacity: 0.85 }}>
          Tell us your details and we’ll notify you when the full VAT/SIC tool is ready.
        </p>

        <form
          action="https://formspree.io/f/xbdwlgdv"
          method="POST"
          style={{ maxWidth: "520px", margin: "30px auto", display: "grid", gap: "12px" }}
        >
          <input type="hidden" name="_subject" value="VAT SIC Tool Early Access Request" />

          <input name="name" placeholder="Name" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />
          <input name="email" type="email" placeholder="Email" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />
          <input name="phone" placeholder="Phone / WhatsApp" required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />

          <select name="user_type" required style={{ padding: "14px", borderRadius: "8px", border: "none" }}>
            <option value="">I am a...</option>
            <option>Accountant / Bookkeeper</option>
            <option>VAT Consultant</option>
            <option>Business Owner</option>
            <option>Student / Trainee</option>
            <option>Other</option>
          </select>

          <textarea
            name="message"
            placeholder="Tell us what you would use this tool for"
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
              cursor: "pointer",
            }}
          >
            Request access
          </button>
        </form>
      </section>
    </div>
  );
}
