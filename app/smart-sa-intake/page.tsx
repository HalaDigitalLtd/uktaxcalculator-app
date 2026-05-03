"use client";

import { useState } from "react";

export default function SmartSAIntake() {
  const [answers, setAnswers] = useState<any>({});

  const handleChange = (key: string, value: any) => {
    setAnswers({ ...answers, [key]: value });
  };

  const inputStyle = {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    marginTop: "5px",
    width: "100%"
  };

  return (
    <div style={{ maxWidth: "850px", margin: "0 auto", padding: "40px 20px", fontFamily: "Arial" }}>

      <h1 style={{ textAlign: "center" }}>Smart Self Assessment Intake</h1>

      <p style={{ textAlign: "center", color: "#666" }}>
        Answer a few questions. We’ll generate your exact document checklist.
      </p>

      {/* BASIC */}
      <h3>Basic Details</h3>
      <input name="name" placeholder="Full Name" style={inputStyle} />
      <input name="email" placeholder="Email" style={inputStyle} />

      {/* SCREENING */}
      <h3 style={{ marginTop: "25px" }}>Income Types</h3>

      {[
        ["employment", "Employment Income"],
        ["self", "Self Employed / CIS"],
        ["rental", "Rental Income"],
        ["dividends", "Dividends"],
        ["capital", "Capital Gains"],
        ["foreign", "Foreign Income"]
      ].map(([key, label]) => (
        <label key={key} style={{ display: "block", marginTop: "10px" }}>
          <input
            type="checkbox"
            onChange={(e) => handleChange(key, e.target.checked)}
          />{" "}
          {label}
        </label>
      ))}

      {/* DYNAMIC CHECKLIST */}
      <div style={{ marginTop: "30px", background: "#f8fafc", padding: "20px", borderRadius: "10px" }}>
        <h3>Your Required Documents</h3>

        <ul>

          {answers.employment && (
            <>
              <li>P60 / P45</li>
              <li>P11D (if benefits)</li>
            </>
          )}

          {answers.self && (
            <>
              <li>Bank statements (full year)</li>
              <li>Sales / income summary</li>
              <li>Expense receipts</li>
              <li>CIS deduction statements</li>
            </>
          )}

          {answers.rental && (
            <>
              <li>Rental income summary</li>
              <li>Letting agent statement</li>
              <li>Mortgage interest statement</li>
              <li>Repair & maintenance costs</li>
            </>
          )}

          {answers.dividends && (
            <>
              <li>Dividend vouchers</li>
            </>
          )}

          {answers.capital && (
            <>
              <li>Purchase & sale details</li>
              <li>Legal fees</li>
            </>
          )}

          {answers.foreign && (
            <>
              <li>Foreign income details</li>
              <li>Tax paid abroad</li>
            </>
          )}

        </ul>
      </div>

      {/* DOCUMENT LINK */}
      <h3 style={{ marginTop: "25px" }}>Upload Documents</h3>

      <input
        placeholder="Paste Google Drive / Dropbox link"
        style={inputStyle}
      />

      {/* NOTES */}
      <textarea
        placeholder="Any additional notes"
        rows={4}
        style={{ ...inputStyle, marginTop: "10px" }}
      />

      {/* SUBMIT */}
      <button
        style={{
          marginTop: "20px",
          padding: "12px",
          background: "#25D366",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold"
        }}
      >
        Submit Information
      </button>

      {/* USP */}
      <p style={{ marginTop: "20px", fontSize: "13px", color: "#666" }}>
        This intelligent system ensures your accountant receives exactly what is needed, reducing delays and follow-ups.
      </p>

    </div>
  );
}
