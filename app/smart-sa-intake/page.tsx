"use client";

import { useMemo, useState } from "react";

type Answers = Record<string, boolean>;
type Status = Record<string, string>;

type FirmConfig = {
  name: string;
  formEndpoint: string;
  contactEmail?: string;
};

const DEFAULT_FORM_ENDPOINT = "https://formspree.io/f/xbdwlgdv";

const firmConfig: Record<string, FirmConfig> = {
  hala: {
    name: "Hala Digital Demo",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
  },

  bnw: {
    name: "BNW Accountants",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
  },

  firm001: {
    name: "Firm 001",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
  },

  firm002: {
    name: "Firm 002",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
  },

  firm003: {
    name: "Firm 003",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
  },
};

const incomeTypes = [
  ["employment", "Employment income"],
  ["self", "Self-employed / CIS"],
  ["rental", "Rental income"],
  ["dividends", "Dividends"],
  ["capital", "Capital gains"],
  ["foreign", "Foreign income"],
];

const documentMap: Record<string, string[]> = {
  employment: ["P60 / P45", "P11D if benefits received", "Employment expenses details"],
  self: ["Full year bank statements", "Sales / income summary", "Expense receipts", "CIS deduction statements", "Mileage or motor costs"],
  rental: ["Rental income summary", "Letting agent statement", "Mortgage interest statement", "Repairs and maintenance costs", "Property ownership details"],
  dividends: ["Dividend vouchers", "Company name and shareholding details"],
  capital: ["Purchase details", "Sale details", "Legal and professional fees", "Improvement costs"],
  foreign: ["Foreign income details", "Foreign tax deducted", "Country and exchange rate details"],
};

const riskMap: Record<string, string[]> = {
  self: [
    "VAT threshold should be reviewed if turnover is close to or above £90,000.",
    "CIS deductions should be agreed to contractor statements.",
  ],
  rental: [
    "Mortgage interest restriction may apply for residential property.",
    "Joint ownership and property percentage should be checked.",
  ],
  dividends: ["Dividend tax depends on total income and tax band allocation."],
  capital: ["UK residential property disposals may require separate CGT reporting."],
  foreign: ["Foreign pages and double tax relief may be required."],
};

function getFirmFromUrl() {
  if (typeof window === "undefined") return "hala";
  const params = new URLSearchParams(window.location.search);
  return params.get("firm") || "hala";
}

export default function SmartSAIntake() {
  const firmKey = getFirmFromUrl();
  const firm = firmConfig[firmKey] || firmConfig.hala;
  const isUnknownFirm = !firmConfig[firmKey];

  const [answers, setAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<Status>({});
  const [submitting, setSubmitting] = useState(false);

  const requiredDocs = useMemo(() => {
    return Object.keys(answers)
      .filter((key) => answers[key])
      .flatMap((key) => documentMap[key] || []);
  }, [answers]);

  const missingDocs = requiredDocs.filter((doc) => status[doc] === "missing");
  const uploadedDocs = requiredDocs.filter((doc) => status[doc] === "uploaded");
  const notApplicableDocs = requiredDocs.filter((doc) => status[doc] === "na");

  const riskFlags = Object.keys(answers)
    .filter((key) => answers[key])
    .flatMap((key) => riskMap[key] || []);

  const selectedProfile = Object.entries(answers)
    .filter(([, value]) => value)
    .map(([key]) => incomeTypes.find(([k]) => k === key)?.[1] || key);

  const summary = `
Smart SA Intake Summary

Firm:
${firm.name}

Firm key:
${firmKey}

Detected profile:
${selectedProfile.length ? selectedProfile.map((x) => `- ${x}`).join("\n") : "- None selected"}

Uploaded:
${uploadedDocs.length ? uploadedDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Missing:
${missingDocs.length ? missingDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Not applicable:
${notApplicableDocs.length ? notApplicableDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Risk flags:
${riskFlags.length ? riskFlags.map((x) => `- ${x}`).join("\n") : "- None"}
`;

  const inputStyle = {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    width: "100%",
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    formData.append("firm_name", firm.name);
    formData.append("firm_key", firmKey);
    formData.append("smart_intake_summary", summary);

    await fetch(firm.formEndpoint, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    });

    window.location.href = "/thank-you";
  }

  return (
    <div style={{ maxWidth: "950px", margin: "0 auto", padding: "40px 20px", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <p style={{ color: "#2563eb", fontWeight: "bold" }}>{firm.name}</p>

        <h1>Smart Self Assessment Intake</h1>

        <p style={{ color: "#64748b", maxWidth: "720px", margin: "10px auto" }}>
          Answer the screening questions. The system generates a tailored document checklist, identifies missing items and sends an accountant-ready summary.
        </p>

        <p style={{ fontSize: "14px", color: "#64748b" }}>
          Firm link: <strong>{`/smart-sa-intake?firm=${firmKey}`}</strong>
        </p>

        {isUnknownFirm ? (
          <div style={{ marginTop: "15px", padding: "14px", background: "#fee2e2", color: "#991b1b", borderRadius: "10px" }}>
            Unknown firm code. This submission will be sent to the Hala Digital demo inbox.
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
        <section style={cardStyle}>
          <h3>Client details</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <input name="client_name" placeholder="Client full name" required style={inputStyle} />
            <input name="client_email" type="email" placeholder="Client email" required style={inputStyle} />
            <input name="client_phone" placeholder="Phone / WhatsApp" required style={inputStyle} />
            <input name="tax_year" placeholder="Tax year e.g. 2024/25" required style={inputStyle} />
          </div>
        </section>

        <section style={cardStyle}>
          <h3>1. Select income types</h3>

          {incomeTypes.map(([key, label]) => (
            <label key={key} style={{ display: "block", marginTop: "10px" }}>
              <input
                type="checkbox"
                checked={!!answers[key]}
                onChange={(event) => {
                  setAnswers((previous) => ({ ...previous, [key]: event.target.checked }));
                }}
              />{" "}
              {label}
            </label>
          ))}
        </section>

        <section style={cardStyle}>
          <h3>2. Required documents</h3>

          {requiredDocs.length === 0 ? (
            <p style={{ color: "#64748b" }}>Select income types above to generate a checklist.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {requiredDocs.map((doc) => (
                <div key={doc} style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "12px", alignItems: "center" }}>
                  <strong>{doc}</strong>
                  <select
                    name={`document_status_${doc}`}
                    value={status[doc] || ""}
                    onChange={(event) => setStatus((previous) => ({ ...previous, [doc]: event.target.value }))}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    <option value="uploaded">Uploaded / provided</option>
                    <option value="missing">Missing</option>
                    <option value="na">Not applicable</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h3>3. Document folder link</h3>
          <input name="document_link" placeholder="Paste Google Drive / Dropbox / OneDrive folder link" style={inputStyle} />
          <p style={{ fontSize: "13px", color: "#64748b" }}>
            For this MVP, documents should be uploaded to a secure shared folder and the link pasted here.
          </p>
        </section>

        <section style={cardStyle}>
          <h3>Accountant-ready summary</h3>

          <div style={{ padding: "16px", background: "#eef6ff", borderRadius: "12px", whiteSpace: "pre-wrap", fontSize: "14px" }}>
            {summary}
          </div>

          {missingDocs.length > 0 ? (
            <div style={{ marginTop: "16px", padding: "16px", background: "#fee2e2", borderRadius: "12px", color: "#991b1b" }}>
              <strong>Missing items detected:</strong>
              <ul>
                {missingDocs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h3>Additional notes</h3>
          <textarea name="notes" placeholder="Anything the accountant should know?" rows={4} style={inputStyle} />
        </section>

        <input type="hidden" name="_subject" value={`Smart SA Intake Submission - ${firm.name}`} />

        <button
          type="submit"
          disabled={submitting}
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
          {submitting ? "Submitting..." : "Submit structured intake pack"}
        </button>
      </form>
    </div>
  );
}

const cardStyle = {
  padding: "24px",
  background: "white",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15,23,42,0.06)",
};
