"use client";

import { useState } from "react";

export default function SmartSAIntake() {
  const [answers, setAnswers] = useState<any>({});
  const [status, setStatus] = useState<any>({});

  const handleAnswer = (key: string, value: boolean) => {
    setAnswers({ ...answers, [key]: value });
  };

  const handleStatus = (doc: string, value: string) => {
    setStatus({ ...status, [doc]: value });
  };

  const checklist: any = [];

  if (answers.employment) {
    checklist.push("P60 / P45", "P11D");
  }

  if (answers.self) {
    checklist.push(
      "Bank statements",
      "Sales summary",
      "Expense receipts",
      "CIS statements"
    );
  }

  if (answers.rental) {
    checklist.push(
      "Rental income summary",
      "Agent statement",
      "Mortgage interest statement"
    );
  }

  if (answers.dividends) {
    checklist.push("Dividend vouchers");
  }

  if (answers.capital) {
    checklist.push("Purchase & sale details");
  }

  const missing = checklist.filter((doc: string) => status[doc] === "missing");

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px", fontFamily: "Arial" }}>

      <h1 style={{ textAlign: "center" }}>Smart SA Intake Tool</h1>

      <h3>Income Types</h3>

      {[
        ["employment", "Employment"],
        ["self", "Self Employed"],
        ["rental", "Rental"],
        ["dividends", "Dividends"],
        ["capital", "Capital Gains"]
      ].map(([key, label]) => (
        <label key={key} style={{ display: "block" }}>
          <input type="checkbox" onChange={(e) => handleAnswer(key, e.target.checked)} />
          {label}
        </label>
      ))}

      {/* CHECKLIST */}
      <div style={{ marginTop: "30px" }}>
        <h3>Required Documents</h3>

        {checklist.map((doc: string) => (
          <div key={doc} style={{ marginBottom: "10px" }}>
            <strong>{doc}</strong>

            <select
              onChange={(e) => handleStatus(doc, e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="">Select</option>
              <option value="uploaded">Uploaded</option>
              <option value="missing">Missing</option>
              <option value="na">Not Applicable</option>
            </select>
          </div>
        ))}
      </div>

      {/* MISSING */}
      <div style={{ marginTop: "30px", background: "#fee2e2", padding: "15px", borderRadius: "10px" }}>
        <h3>Missing Items</h3>

        {missing.length === 0 ? (
          <p>Nothing missing 🎉</p>
        ) : (
          <ul>
            {missing.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      {/* SUMMARY */}
      <div style={{ marginTop: "30px", background: "#eef6ff", padding: "15px", borderRadius: "10px" }}>
        <h3>Accountant Summary</h3>

        <p>
          Profile:{" "}
          {Object.keys(answers)
            .filter((k) => answers[k])
            .join(", ")}
        </p>

        <p>Missing: {missing.join(", ") || "None"}</p>
      </div>

    </div>
  );
}
