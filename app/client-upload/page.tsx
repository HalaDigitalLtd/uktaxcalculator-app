"use client";

import { useState } from "react";

export default function ClientUploadPage() {
  const [type, setType] = useState("");

  const inputStyle = {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    width: "100%"
  };

  return (
    <div style={{ fontFamily: "Arial", maxWidth: "850px", margin: "0 auto", padding: "40px 20px" }}>

      <h1 style={{ textAlign: "center" }}>
        Client Information & Structured Upload
      </h1>

      <p style={{ textAlign: "center", color: "#64748b" }}>
        Complete all sections carefully. This replaces multiple follow-ups.
      </p>

      <form
        action="https://formspree.io/f/xbdwlgdv"
        method="POST"
        style={{ marginTop: "30px", display: "grid", gap: "18px" }}
      >

        {/* BASIC */}
        <h3>Basic Details</h3>

        <input name="name" placeholder="Full Name" required style={inputStyle} />
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="phone" placeholder="Phone / WhatsApp" required style={inputStyle} />

        <select
          name="business_type"
          required
          style={inputStyle}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Select Business Type</option>
          <option value="sole">Sole Trader</option>
          <option value="ltd">Limited Company</option>
          <option value="partnership">Partnership</option>
        </select>

        {/* SOLE TRADER */}
        {type === "sole" && (
          <>
            <h3>Self-Employed Checklist</h3>

            <p>Upload ALL relevant documents in one Google Drive folder and paste link below.</p>

            <ul>
              <li>• Bank statements (full year)</li>
              <li>• Income invoices / sales summary</li>
              <li>• Expense receipts</li>
              <li>• UTR (if available)</li>
              <li>• Previous year tax return (if available)</li>
            </ul>

            <input
              name="sole_docs"
              placeholder="Paste Google Drive link"
              style={inputStyle}
            />
          </>
        )}

        {/* LIMITED COMPANY */}
        {type === "ltd" && (
          <>
            <h3>Limited Company Checklist</h3>

            <p>Upload documents in ONE folder to avoid delays.</p>

            <ul>
              <li>• Business bank statements (full year)</li>
              <li>• Sales invoices / Stripe / PayPal reports</li>
              <li>• Expense receipts</li>
              <li>• Payroll reports (if applicable)</li>
              <li>• VAT returns (if registered)</li>
              <li>• HMRC letters</li>
              <li>• Companies House documents</li>
              <li>• Loan / finance agreements</li>
            </ul>

            <input
              name="ltd_docs"
              placeholder="Paste Google Drive link"
              style={inputStyle}
            />
          </>
        )}

        {/* PARTNERSHIP */}
        {type === "partnership" && (
          <>
            <h3>Partnership Checklist</h3>

            <ul>
              <li>• Bank statements</li>
              <li>• Income records</li>
              <li>• Expense receipts</li>
              <li>• Partner details</li>
            </ul>

            <input
              name="partnership_docs"
              placeholder="Paste Google Drive link"
              style={inputStyle}
            />
          </>
        )}

        {/* EXTRA */}
        <h3>Additional Information</h3>

        <textarea
          name="notes"
          placeholder="Anything accountant should know?"
          rows={4}
          style={inputStyle}
        />

        <select name="urgency" style={inputStyle}>
          <option value="">Urgency</option>
          <option>Normal</option>
          <option>Urgent (deadline close)</option>
        </select>

        {/* SUBMIT */}
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
          Submit Complete Pack
        </button>

      </form>

      <p style={{ marginTop: "20px", fontSize: "13px", color: "#64748b" }}>
        This structured system helps reduce delays and ensures your accountant receives everything in one go.
      </p>

    </div>
  );
}
