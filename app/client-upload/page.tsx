export default function ClientUploadPage() {
  const inputStyle = {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    width: "100%"
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "50px 20px", maxWidth: "800px", margin: "0 auto" }}>

      <h1 style={{ textAlign: "center" }}>
        Client Information & Document Upload
      </h1>

      <p style={{ textAlign: "center", color: "#64748b" }}>
        Please complete all sections and upload required documents.
      </p>

      <form
        action="https://formspree.io/f/xbdwlgdv"
        method="POST"
        encType="multipart/form-data"
        style={{ marginTop: "30px", display: "grid", gap: "15px" }}
      >

        {/* Basic Info */}
        <h3>Basic Information</h3>

        <input name="name" placeholder="Full Name" required style={inputStyle} />
        <input name="email" type="email" placeholder="Email Address" required style={inputStyle} />
        <input name="phone" placeholder="Phone / WhatsApp" required style={inputStyle} />

        <select name="business_type" required style={inputStyle}>
          <option value="">Business Type</option>
          <option>Sole Trader</option>
          <option>Limited Company</option>
          <option>Partnership</option>
        </select>

        {/* Financial Info */}
        <h3>Financial Information</h3>

        <input name="turnover" placeholder="Approx Annual Turnover" style={inputStyle} />
        <input name="expenses" placeholder="Approx Expenses" style={inputStyle} />

        <textarea
          name="notes"
          placeholder="Any additional notes"
          rows={4}
          style={inputStyle}
        />

        {/* File Upload */}
        <h3>Upload Documents</h3>

        <input type="file" name="documents" multiple />

        {/* Submit */}
        <button
          type="submit"
          style={{
            padding: "14px",
            background: "#25D366",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Submit Information
        </button>

      </form>

      {/* Trust */}
      <p style={{ marginTop: "25px", fontSize: "13px", color: "#64748b" }}>
        Your data is securely transmitted and used only for accounting purposes.
      </p>

    </div>
  );
}
