"use client";

import { useMemo, useState } from "react";

const sampleData = [
  {
    sic: "69201",
    activity: "Accounting and auditing activities",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Accounting, bookkeeping, payroll and tax services are normally standard-rated.",
    questions: "Check if any exempt financial services are also being supplied.",
  },
  {
    sic: "62012",
    activity: "Business and domestic software development",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "UK software development, SaaS, hosting and IT support are normally standard-rated.",
    questions: "Check customer location and B2B/B2C place of supply rules.",
  },
  {
    sic: "68209",
    activity: "Other letting and operating of own or leased real estate",
    treatment: "Exempt / Complex",
    rate: "Exempt unless opted to tax",
    risk: "High",
    preview: "Residential letting is usually exempt. Commercial property may be taxable if opted to tax.",
    questions: "Is it residential or commercial? Has an option to tax been made?",
  },
  {
    sic: "56101",
    activity: "Licensed restaurants",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Restaurant meals, hot food, hot drinks and alcohol are normally standard-rated.",
    questions: "Check takeaway/cold food and mixed food sales.",
  },
  {
    sic: "86900",
    activity: "Other human health activities",
    treatment: "Exempt / Mixed",
    rate: "Depends on provider and service",
    risk: "High",
    preview: "Medical treatment by regulated professionals may be exempt, but cosmetic or non-medical services may be taxable.",
    questions: "Is the provider regulated? Is the service medical or cosmetic?",
  },
  {
    sic: "41100",
    activity: "Development of building projects",
    treatment: "Mixed / Complex",
    rate: "0%, 5%, 20% or Exempt",
    risk: "High",
    preview: "Property development VAT depends on new build, conversion, commercial property and option to tax.",
    questions: "Is it new residential, conversion, commercial, or existing residential?",
  },
  {
    sic: "43210",
    activity: "Electrical installation",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Medium",
    preview: "Most electrical installation services are standard-rated, but construction DRC may apply.",
    questions: "Is the customer VAT registered? Is CIS domestic reverse charge relevant?",
  },
  {
    sic: "45200",
    activity: "Maintenance and repair of motor vehicles",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Vehicle repairs, servicing and parts are normally standard-rated.",
    questions: "Check MOT fees and disbursement treatment separately.",
  },
  {
    sic: "85590",
    activity: "Other education not elsewhere classified",
    treatment: "Exempt / Standard Rated",
    rate: "Depends on eligible body status",
    risk: "High",
    preview: "Education can be exempt if supplied by an eligible body. Commercial training is often standard-rated.",
    questions: "Is the provider an eligible body? Is the training vocational or commercial?",
  },
  {
    sic: "96020",
    activity: "Hairdressing and other beauty treatment",
    treatment: "Likely Standard Rated",
    rate: "20%",
    risk: "Low",
    preview: "Hair, beauty, nails, tanning, massage and cosmetic treatments are normally standard-rated.",
    questions: "Check if any medical treatment exemption is being claimed.",
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
        item.treatment.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#0f172a" }}>
      <section style={{ padding: "85px 20px", textAlign: "center", background: "linear-gradient(135deg, #0f172a, #1e3a8a)", color: "white" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>Hala Digital VAT Tool</p>

        <h1 style={{ fontSize: "44px", marginBottom: "20px" }}>
          VAT SIC Code Intelligence Checker
        </h1>

        <p style={{ fontSize: "20px", maxWidth: "850px", margin: "0 auto", opacity: 0.9 }}>
          Search a UK SIC code and get an indicative VAT treatment, risk flag and practitioner review prompt.
        </p>

        <p style={{ marginTop: "14px", fontSize: "15px", opacity: 0.85 }}>
          Free preview available. Full database access will be limited to paid users and early-access members.
        </p>

        <div style={{ marginTop: "28px" }}>
          <a href="#early-access-form" style={{ display: "inline-block", padding: "14px 24px", background: "#25D366", color: "white", borderRadius: "10px", textDecoration: "none", fontWeight: "bold", margin: "8px" }}>
            Request Early Access
          </a>

          <a href="/vat-registration" style={{ display: "inline-block", padding: "14px 24px", background: "#2563eb", color: "white", borderRadius: "10px", textDecoration: "none", fontWeight: "bold", margin: "8px" }}>
            VAT Registration Guide
          </a>
        </div>
      </section>

      <section style={{ padding: "60px 20px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "32px" }}>Free Preview Search</h2>

          <p style={{ textAlign: "center", color: "#475569", maxWidth: "760px", margin: "10px auto 30px" }}>
            This preview shows limited sample data only. The full tool will include the complete SIC/VAT database,
            risk scoring, HMRC reference prompts, client questions and review flags.
          </p>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SIC code or activity e.g. 69201, property, software, health"
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
              <div key={item.sic} style={{ background: "white", padding: "24px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(15,23,42,0.08)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ maxWidth: "650px" }}>
                    <h3 style={{ margin: 0 }}>
                      SIC {item.sic} — {item.activity}
                    </h3>
                    <p style={{ color: "#475569", marginTop: "8px" }}>{item.preview}</p>
                    <p style={{ color: "#334155", marginTop: "8px" }}>
                      <strong>Review question:</strong> {item.questions}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontWeight: "bold", color: "#2563eb" }}>{item.treatment}</p>
                    <p style={{ margin: "4px 0", color: "#334155" }}>{item.rate}</p>
                    <p style={{
                      display: "inline-block",
                      margin: 0,
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: item.risk === "High" ? "#fee2e2" : item.risk === "Medium" ? "#fef3c7" : "#dcfce7",
                      color: item.risk === "High" ? "#991b1b" : item.risk === "Medium" ? "#92400e" : "#166534",
                      fontWeight: "bold",
                      fontSize: "13px",
                    }}>
                      {item.risk} Risk
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "18px", padding: "16px", borderRadius: "12px", background: "#f8fafc", color: "#475569" }}>
                  🔒 Full analysis locked: HMRC references, partial exemption flags, DRC/margin scheme checks,
                  special scheme notes, practitioner comments and client evidence checklist.
                </div>
              </div>
            ))}
          </div>

          {results.length === 0 ? (
            <div style={{ marginTop: "25px", padding: "20px", background: "white", borderRadius: "14px", textAlign: "center" }}>
              <strong>No preview result found.</strong>
              <p>Request access to the full SIC/VAT database for wider coverage.</p>
              <a href="#early-access-form" style={{ color: "#2563eb", fontWeight: "bold" }}>
                Join early access →
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ padding: "70px 20px", textAlign: "center", background: "#eef6ff" }}>
        <h2 style={{ fontSize: "34px" }}>What the Full Version Will Include</h2>

        <p style={{ maxWidth: "760px", margin: "10px auto", color: "#334155" }}>
          The full version is being designed for accounting practices, VAT review work and client onboarding.
        </p>

        <div style={{ maxWidth: "1000px", margin: "35px auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
          {[
            "707+ SIC code reference",
            "VAT treatment categories",
            "Risk scoring",
            "Confidence levels",
            "Practitioner notes",
            "HMRC reference prompts",
            "Partial exemption flags",
            "DRC and margin scheme prompts",
            "Client review questions",
          ].map((text) => (
            <div key={text} style={{ background: "white", padding: "20px", borderRadius: "14px", boxShadow: "0 8px 25px rgba(15,23,42,0.06)" }}>
              ✅ {text}
            </div>
          ))}
        </div>

        <a href="#early-access-form" style={{ display: "inline-block", padding: "14px 24px", background: "#25D366", color: "white", borderRadius: "10px", textDecoration: "none", fontWeight: "bold" }}>
          Request Early Access
        </a>

        <p style={{ marginTop: "14px", color: "#475569" }}>
          Prefer a quick chat?
          <a href="https://wa.me/447884063169?text=Hi%20Ikram,%20I%20am%20interested%20in%20the%20VAT%20SIC%20Code%20Intelligence%20Tool." style={{ color: "#2563eb", marginLeft: "6px", fontWeight: "bold" }}>
            Message us on WhatsApp
          </a>
        </p>
      </section>

      <section id="early-access-form" style={{ padding: "70px 20px", background: "#0f172a", color: "white", textAlign: "center" }}>
        <h2 style={{ fontSize: "34px" }}>Join the Early Access List</h2>

        <p style={{ maxWidth: "720px", margin: "10px auto", opacity: 0.85 }}>
          Submit your details and we’ll notify you when the full VAT/SIC tool is ready.
        </p>

        <form action="https://formspree.io/f/xbdwlgdv" method="POST" style={{ maxWidth: "520px", margin: "30px auto", display: "grid", gap: "12px" }}>
          <input type="hidden" name="_subject" value="VAT SIC Tool Early Access Request" />
          <input type="hidden" name="tool" value="VAT SIC Code Intelligence Checker" />

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

          <textarea name="message" placeholder="Tell us what you would use this tool for" rows={4} required style={{ padding: "14px", borderRadius: "8px", border: "none" }} />

          <button type="submit" style={{ padding: "15px", background: "#25D366", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer" }}>
            Request access
          </button>
        </form>
      </section>
    </div>
  );
}
