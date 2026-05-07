export default function CompanyFormationPage() {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: "#0f172a" }}>
      <section style={{ padding: "80px 20px", textAlign: "center", background: "#0f172a", color: "white" }}>
        <p style={{ color: "#93c5fd", fontWeight: "bold" }}>Hala Digital Ltd</p>

        <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
          UK Limited Company Formation
        </h1>

        <p style={{ maxWidth: "760px", margin: "0 auto", fontSize: "19px", opacity: 0.9 }}>
          Set up your UK limited company with Companies House filing, accountant support and identity verification guidance.
        </p>
      </section>

      <section style={{ padding: "60px 20px", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "32px" }}>
            Start your company the right way
          </h2>

          <p style={{ textAlign: "center", maxWidth: "760px", margin: "10px auto 35px", color: "#475569" }}>
            Complete the form below and we’ll review your details before proceeding with incorporation and compliance setup.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "18px", marginBottom: "35px" }}>
            {[
              "Company name check",
              "Companies House filing",
              "Director and shareholder setup",
              "Registered office guidance",
              "ACSP / identity verification guidance",
              "Accountant support after setup",
            ].map((item) => (
              <div key={item} style={{ background: "white", padding: "20px", borderRadius: "14px", boxShadow: "0 8px 25px rgba(15,23,42,0.06)" }}>
                ✅ {item}
              </div>
            ))}
          </div>

          <form
            action="https://formspree.io/f/xbdwlgdv"
            method="POST"
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "18px",
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              display: "grid",
              gap: "16px",
            }}
          >
            <input type="hidden" name="_subject" value="New Company Formation Enquiry" />

            <h3>Contact details</h3>

            <input name="name" placeholder="Your full name" required style={inputStyle} />
            <input name="email" type="email" placeholder="Email address" required style={inputStyle} />
            <input name="phone" placeholder="Phone / WhatsApp" required style={inputStyle} />

            <h3>Company details</h3>

            <input name="preferred_company_name" placeholder="Preferred company name" required style={inputStyle} />
            <input name="alternative_company_name" placeholder="Alternative company name" style={inputStyle} />

            <select name="business_activity" required style={inputStyle}>
              <option value="">Main business activity</option>
              <option>Consultancy</option>
              <option>Online business / e-commerce</option>
              <option>Property</option>
              <option>Construction / trade</option>
              <option>IT / software</option>
              <option>Marketing / creative</option>
              <option>Other</option>
            </select>

            <textarea
              name="business_description"
              placeholder="Briefly describe what the company will do"
              rows={4}
              required
              style={inputStyle}
            />

            <h3>Directors and shareholders</h3>

            <select name="number_of_directors" required style={inputStyle}>
              <option value="">Number of directors</option>
              <option>1</option>
              <option>2</option>
              <option>3+</option>
            </select>

            <select name="number_of_shareholders" required style={inputStyle}>
              <option value="">Number of shareholders</option>
              <option>1</option>
              <option>2</option>
              <option>3+</option>
            </select>

            <textarea
              name="director_shareholder_details"
              placeholder="Provide director/shareholder names and share split if known"
              rows={4}
              required
              style={inputStyle}
            />

            <h3>Address and compliance</h3>

            <select name="registered_office_required" required style={inputStyle}>
              <option value="">Do you need registered office support?</option>
              <option>Yes</option>
              <option>No</option>
              <option>Not sure</option>
            </select>

            <select name="identity_verification_required" required style={inputStyle}>
              <option value="">Do you need identity verification guidance?</option>
              <option>Yes</option>
              <option>No</option>
              <option>Not sure</option>
            </select>

            <select name="ongoing_accountant_support" required style={inputStyle}>
              <option value="">Do you need ongoing accountant support?</option>
              <option>Yes, monthly support</option>
              <option>Yes, annual accounts only</option>
              <option>Not sure yet</option>
              <option>No</option>
            </select>

            <textarea
              name="message"
              placeholder="Any extra details or questions?"
              rows={4}
              style={inputStyle}
            />

            <button
              type="submit"
              style={{
                padding: "15px",
                background: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Submit company formation enquiry
            </button>

            <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center" }}>
              By submitting, you agree to be contacted about your company formation enquiry.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  padding: "14px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "15px",
};
