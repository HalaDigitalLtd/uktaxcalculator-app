"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Answers = Record<string, boolean>;
type Status = Record<string, string>;

type FirmConfig = {
  name: string;
  formEndpoint: string;
  contactEmail?: string;
  brandColor?: string;
};

const DEFAULT_FORM_ENDPOINT = "https://formspree.io/f/xbdwlgdv";

const firmSlots: Record<string, FirmConfig> = Object.fromEntries(
  Array.from({ length: 100 }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return [
      `firm${number}`,
      {
        name: `Firm ${number}`,
        formEndpoint: DEFAULT_FORM_ENDPOINT,
        brandColor: "#2563eb",
      },
    ];
  })
);

const firmConfig: Record<string, FirmConfig> = {
  default: {
    name: "Your Accountant",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
    brandColor: "#2563eb",
  },
  bnw: {
    name: "BNW Accountants",
    formEndpoint: DEFAULT_FORM_ENDPOINT,
    brandColor: "#0f172a",
  },
  ...firmSlots,
};

const incomeTypes = [
  ["director", "Director / shareholder of a limited company"],
  ["employment", "Employment income"],
  ["self", "Self-employed / sole trader"],
  ["cis", "CIS subcontractor income"],
  ["partnership", "Partnership income"],
  ["rental", "Rental income"],
  ["interest", "Bank interest / savings income"],
  ["dividends", "Dividends"],
  ["benefits", "Benefits in kind / P11D"],
  ["statePension", "State pension"],
  ["privatePension", "Private pension"],
  ["capital", "Capital gains / asset sales"],
  ["foreign", "Foreign income"],
  ["crypto", "Crypto / share trading"],
  ["childBenefit", "Child Benefit"],
  ["businessLoan", "Business loan / interest paid"],
  ["giftAid", "Gift Aid donations"],
  ["pensionContrib", "Personal pension contributions"],
  ["eis", "EIS / SEIS / VCT investment"],
  ["blindAllowance", "Blind Person’s Allowance"],
  ["marriageAllowance", "Marriage Allowance"],
  ["studentLoan", "Student loan"],
  ["residence", "Arrival / departure / residence / domicile"],
  ["taxCode", "Tax code adjustments"],
  ["hmrcChanges", "HMRC record changes"],
  ["otherIncome", "Other income"],
];

const documentMap: Record<string, string[]> = {
  director: [
    "Company name and company number",
    "Director start/end date if applicable",
    "Salary/payroll summary",
    "Dividend vouchers",
    "Director loan account details if relevant",
  ],
  employment: [
    "P60 for each employment",
    "P45 if employment ended during the year",
    "Employment start and end dates",
    "P11D if benefits received",
    "Employment expenses details",
  ],
  self: [
    "Business start/end date if applicable",
    "Nature of trade/business activity",
    "Business address/postcode",
    "Full year business bank statements",
    "Sales/income summary",
    "Expense receipts",
    "Mileage or motor costs",
    "Use of home details",
  ],
  cis: [
    "CIS deduction statements",
    "Gross CIS income before deductions",
    "CIS tax deducted",
    "CIS expenses",
  ],
  partnership: [
    "Partnership UTR",
    "Partnership statement",
    "Partnership accounts",
    "Partner profit share details",
  ],
  rental: [
    "Property address",
    "Ownership percentage",
    "Rental income summary",
    "Letting agent statement",
    "Mortgage interest statement",
    "Repairs and maintenance costs",
    "Insurance/service charges/ground rent",
  ],
  interest: ["Bank interest summary", "Tax deducted from interest if any"],
  dividends: [
    "Dividend vouchers",
    "Company name and shareholding details",
    "Investment platform dividend statement if applicable",
  ],
  benefits: [
    "P11D",
    "Confirmation if benefits were payrolled",
    "Company car / medical insurance / other benefit details",
  ],
  statePension: ["State pension annual amount", "DWP letter or bank statement evidence"],
  privatePension: ["P60 from pension provider", "Private pension annual statement"],
  capital: [
    "Asset type sold",
    "Purchase date and cost",
    "Sale date and proceeds",
    "Legal/professional fees",
    "Improvement costs",
    "60-day CGT report reference if UK residential property",
  ],
  foreign: [
    "Foreign income type",
    "Country",
    "Amount received",
    "Foreign tax deducted",
    "Exchange rate used",
  ],
  crypto: ["Crypto transaction report", "Share trading statements", "Capital gains summary"],
  childBenefit: ["Amount of Child Benefit received", "Number of children", "Partner income details if relevant"],
  businessLoan: ["Loan agreement", "Interest charged", "Purpose of loan"],
  giftAid: ["Donation date", "Donation amount", "Charity name", "Gift Aid confirmation"],
  pensionContrib: ["Pension provider name", "Personal pension contribution statement", "Gross contribution amount"],
  eis: ["EIS certificate", "SEIS certificate", "VCT certificate"],
  blindAllowance: ["Blind Person’s Allowance claim details", "Supporting evidence if available"],
  marriageAllowance: ["Spouse / civil partner details", "Confirmation of income position"],
  studentLoan: ["Student loan plan type", "Student Loans Company statement", "Repayments already deducted"],
  residence: ["UK arrival date", "UK departure date", "Days spent in the UK", "Residence/domicile notes"],
  taxCode: ["PAYE coding notice", "Details of prior year underpayment / tax code adjustment"],
  hmrcChanges: ["New address if changed", "Name change details", "Bank detail changes", "HMRC correspondence"],
  otherIncome: ["Details of other income", "Trust/estate income details", "Taxable state benefit details"],
};

const riskMap: Record<string, string[]> = {
  director: ["Director salary/dividend mix should be reviewed.", "Director loan account may create tax consequences."],
  self: ["VAT threshold should be reviewed if turnover is close to or above £90,000."],
  cis: ["CIS turnover should normally be gross before CIS deduction.", "CIS deductions should be agreed to contractor statements."],
  rental: ["Mortgage interest restriction may apply for residential property.", "Joint ownership and property percentage should be checked."],
  capital: ["UK residential property disposals may require 60-day CGT reporting."],
  foreign: ["Foreign pages and double tax relief may be required."],
  childBenefit: ["High Income Child Benefit Charge may apply depending on income level."],
  residence: ["Residence, domicile and split-year treatment require detailed review."],
  taxCode: ["PAYE coding adjustments should be checked against HMRC records."],
};

function getFirmFromUrl() {
  if (typeof window === "undefined") return "hala";
  const params = new URLSearchParams(window.location.search);
  return params.get("firm") || "default";
}

export default function SmartSAIntake() {
  const firmKey = getFirmFromUrl();
  const firm = firmConfig[firmKey] || firmConfig.hala;
  const isUnknownFirm = !firmConfig[firmKey];

  const [answers, setAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<Status>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const requiredDocs = useMemo(() => {
    const docs = Object.keys(answers)
      .filter((key) => answers[key])
      .flatMap((key) => documentMap[key] || []);

    return Array.from(new Set(docs));
  }, [answers]);

  const missingDocs = requiredDocs.filter((doc) => status[doc] === "missing");
  const uploadedDocs = requiredDocs.filter((doc) => status[doc] === "uploaded");
  const notApplicableDocs = requiredDocs.filter((doc) => status[doc] === "na");

  const riskFlags = Array.from(
    new Set(
      Object.keys(answers)
        .filter((key) => answers[key])
        .flatMap((key) => riskMap[key] || [])
    )
  );

  const selectedProfile = Object.entries(answers)
    .filter(([, value]) => value)
    .map(([key]) => incomeTypes.find(([k]) => k === key)?.[1] || key);

  const accountantSummary = `
FULL SELF ASSESSMENT INTAKE SUMMARY

Firm:
${firm.name}

Firm key:
${firmKey}

Detected income/tax profile:
${selectedProfile.length ? selectedProfile.map((x) => `- ${x}`).join("\n") : "- None selected"}

Documents uploaded/provided:
${uploadedDocs.length ? uploadedDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Documents missing:
${missingDocs.length ? missingDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Documents marked not applicable:
${notApplicableDocs.length ? notApplicableDocs.map((x) => `- ${x}`).join("\n") : "- None"}

Internal accountant review flags:
${riskFlags.length ? riskFlags.map((x) => `- ${x}`).join("\n") : "- None"}

Note:
Risk flags are internal prompts for the accountant only and should not be treated as client-facing tax advice.
`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    try {
      const formData = new FormData(event.currentTarget);
      formData.append("firm_name", firm.name);
      formData.append("firm_key", firmKey);
      formData.append("accountant_internal_summary", accountantSummary);
      formData.append("internal_risk_flags", riskFlags.join(" | "));
      formData.append("client_selected_profile", selectedProfile.join(" | "));
      formData.append("client_missing_documents", missingDocs.join(" | "));
      formData.append("client_uploaded_documents", uploadedDocs.join(" | "));

      const response = await fetch(firm.formEndpoint, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Form submission failed");

      window.location.href = "/thank-you";
    } catch {
      setSubmitError("Submission failed. Please check your internet connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <p style={{ color: firm.brandColor || "#2563eb", fontWeight: "bold" }}>{firm.name}</p>
        <h1>Self Assessment Information Request</h1>

        <p style={introStyle}>
          Please complete this form carefully so we can prepare your Self Assessment tax return efficiently and request the correct documents from you.
        </p>

        {isUnknownFirm && (
          <div style={warningStyle}>
            This is a generic intake link. Please confirm with your accountant if required.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
        <section style={cardStyle}>
          <h3>Client personal details</h3>

          <div style={gridStyle}>
            <input name="client_name" placeholder="Full name" required style={inputStyle} />
            <input name="date_of_birth" type="date" required style={inputStyle} />
            <input name="utr_number" placeholder="UTR number" style={inputStyle} />
            <input name="national_insurance_number" placeholder="National Insurance number" style={inputStyle} />
            <input name="gender" placeholder="Gender" style={inputStyle} />
            <input name="nationality" placeholder="Nationality" style={inputStyle} />
            <input name="client_email" type="email" placeholder="Email address" required style={inputStyle} />
            <input name="client_phone" placeholder="Phone / WhatsApp" required style={inputStyle} />
            <input name="tax_year" placeholder="Tax year e.g. 2024/25" required style={inputStyle} />
            <input name="last_tax_return_year" placeholder="Last submitted tax return year, if known" style={inputStyle} />
            <input name="tax_residency" placeholder="Tax residency e.g. UK resident / non-resident" style={inputStyle} />
            <input name="domicile_status" placeholder="Domicile status if known" style={inputStyle} />
          </div>

          <textarea name="current_address" placeholder="Current residential address and postcode" rows={3} required style={inputStyle} />
          <textarea name="previous_address" placeholder="Previous address if changed during the tax year" rows={3} style={inputStyle} />
        </section>

        <section style={cardStyle}>
          <h3>Bank details for HMRC repayment, if applicable</h3>
          <div style={gridStyle}>
            <input name="bank_account_title" placeholder="Account title" style={inputStyle} />
            <input name="bank_name" placeholder="Bank name" style={inputStyle} />
            <input name="sort_code" placeholder="Sort code" style={inputStyle} />
            <input name="account_number" placeholder="Account number" style={inputStyle} />
          </div>
        </section>

        <section style={cardStyle}>
          <h3>1. Select all relevant income / tax areas</h3>

          {incomeTypes.map(([key, label]) => (
            <label key={key} style={{ display: "block", marginTop: "10px" }}>
              <input
                type="checkbox"
                checked={!!answers[key]}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [key]: event.target.checked,
                  }))
                }
              />{" "}
              {label}
            </label>
          ))}
        </section>

        {answers.director && (
          <section style={cardStyle}>
            <h3>Director / shareholder details</h3>
            <div style={gridStyle}>
              <input name="company_name" placeholder="Company name" style={inputStyle} />
              <input name="company_number" placeholder="Company number" style={inputStyle} />
              <input name="director_start_date" type="date" style={inputStyle} />
              <input name="director_end_date" type="date" style={inputStyle} />
              <input name="director_salary" placeholder="Director salary received" style={inputStyle} />
              <input name="dividends_received" placeholder="Total dividends received" style={inputStyle} />
              <input name="shareholding_percentage" placeholder="Shareholding percentage" style={inputStyle} />
              <input name="director_loan_balance" placeholder="Director loan balance if known" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.employment && (
          <section style={cardStyle}>
            <h3>Employment details</h3>
            <div style={gridStyle}>
              <input name="employer_name" placeholder="Employer name(s)" style={inputStyle} />
              <input name="employment_start_date" type="date" style={inputStyle} />
              <input name="employment_end_date" type="date" style={inputStyle} />
              <input name="gross_salary" placeholder="Gross salary from P60/P45" style={inputStyle} />
              <input name="tax_deducted" placeholder="PAYE tax deducted" style={inputStyle} />
              <input name="benefits_amount" placeholder="Benefits/P11D amount" style={inputStyle} />
            </div>
            <textarea name="employment_expenses" placeholder="Employment expenses to claim, if any" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.self && (
          <section style={cardStyle}>
            <h3>Self-employment details</h3>
            <div style={gridStyle}>
              <input name="self_employment_start_date" type="date" style={inputStyle} />
              <input name="self_employment_end_date" type="date" style={inputStyle} />
              <input name="nature_of_trade" placeholder="Nature of trade" style={inputStyle} />
              <input name="business_postcode" placeholder="Business postcode" style={inputStyle} />
              <input name="turnover" placeholder="Turnover / sales" style={inputStyle} />
              <input name="expenses" placeholder="Total expenses" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.cis && (
          <section style={cardStyle}>
            <h3>CIS details</h3>
            <div style={gridStyle}>
              <input name="cis_gross_income" placeholder="Gross CIS income before deductions" style={inputStyle} />
              <input name="cis_tax_deducted" placeholder="CIS tax deducted" style={inputStyle} />
              <input name="cis_expenses" placeholder="CIS expenses" style={inputStyle} />
              <input name="cis_contractors" placeholder="Contractor names if known" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.partnership && (
          <section style={cardStyle}>
            <h3>Partnership details</h3>
            <div style={gridStyle}>
              <input name="partnership_name" placeholder="Partnership name" style={inputStyle} />
              <input name="partnership_utr" placeholder="Partnership UTR" style={inputStyle} />
              <input name="profit_share" placeholder="Your profit share" style={inputStyle} />
              <input name="partnership_tax_year" placeholder="Partnership accounting period" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.rental && (
          <section style={cardStyle}>
            <h3>Rental property details</h3>
            <div style={gridStyle}>
              <input name="ownership_percentage" placeholder="Ownership percentage" style={inputStyle} />
              <input name="rent_received" placeholder="Total rent received" style={inputStyle} />
              <input name="mortgage_interest" placeholder="Mortgage interest paid" style={inputStyle} />
              <input name="rental_expenses" placeholder="Total rental expenses" style={inputStyle} />
            </div>
            <textarea name="property_address" placeholder="Rental property address(es)" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.interest && (
          <section style={cardStyle}>
            <h3>Bank interest details</h3>
            <div style={gridStyle}>
              <input name="bank_interest_amount" placeholder="Total bank interest received" style={inputStyle} />
              <input name="tax_deducted_from_interest" placeholder="Tax deducted, if any" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.dividends && (
          <section style={cardStyle}>
            <h3>Dividend details</h3>
            <div style={gridStyle}>
              <input name="dividend_company_names" placeholder="Company / platform names" style={inputStyle} />
              <input name="total_dividends" placeholder="Total dividends received" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.statePension && (
          <section style={cardStyle}>
            <h3>State pension details</h3>
            <input name="state_pension_amount" placeholder="Annual state pension amount" style={inputStyle} />
          </section>
        )}

        {answers.privatePension && (
          <section style={cardStyle}>
            <h3>Private pension details</h3>
            <div style={gridStyle}>
              <input name="pension_provider" placeholder="Pension provider" style={inputStyle} />
              <input name="private_pension_amount" placeholder="Annual private pension amount" style={inputStyle} />
              <input name="pension_tax_deducted" placeholder="Tax deducted" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.capital && (
          <section style={cardStyle}>
            <h3>Capital gains details</h3>
            <div style={gridStyle}>
              <input name="asset_sold" placeholder="Asset sold" style={inputStyle} />
              <input name="purchase_date" type="date" style={inputStyle} />
              <input name="purchase_cost" placeholder="Purchase cost" style={inputStyle} />
              <input name="sale_date" type="date" style={inputStyle} />
              <input name="sale_proceeds" placeholder="Sale proceeds" style={inputStyle} />
              <input name="sale_costs" placeholder="Legal/professional fees" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.foreign && (
          <section style={cardStyle}>
            <h3>Foreign income details</h3>
            <div style={gridStyle}>
              <input name="foreign_country" placeholder="Country" style={inputStyle} />
              <input name="foreign_income_type" placeholder="Income type" style={inputStyle} />
              <input name="foreign_income_amount" placeholder="Amount received" style={inputStyle} />
              <input name="foreign_tax_paid" placeholder="Foreign tax paid/deducted" style={inputStyle} />
              <input name="exchange_rate_used" placeholder="Exchange rate used" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.crypto && (
          <section style={cardStyle}>
            <h3>Crypto / share trading details</h3>
            <textarea name="crypto_share_details" placeholder="Provide exchange/platform names and summary of gains/losses" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.childBenefit && (
          <section style={cardStyle}>
            <h3>Child Benefit details</h3>
            <div style={gridStyle}>
              <input name="child_benefit_amount" placeholder="Amount received" style={inputStyle} />
              <input name="number_of_children" placeholder="Number of children" style={inputStyle} />
              <input name="partner_income" placeholder="Partner income if relevant" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.businessLoan && (
          <section style={cardStyle}>
            <h3>Business loan details</h3>
            <div style={gridStyle}>
              <input name="loan_amount" placeholder="Loan amount" style={inputStyle} />
              <input name="loan_interest" placeholder="Interest paid/charged" style={inputStyle} />
              <input name="loan_purpose" placeholder="Purpose of loan" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.giftAid && (
          <section style={cardStyle}>
            <h3>Gift Aid details</h3>
            <div style={gridStyle}>
              <input name="gift_aid_total" placeholder="Total Gift Aid donations" style={inputStyle} />
              <input name="charity_names" placeholder="Charity names" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.pensionContrib && (
          <section style={cardStyle}>
            <h3>Personal pension contribution details</h3>
            <div style={gridStyle}>
              <input name="pension_provider_name" placeholder="Pension provider" style={inputStyle} />
              <input name="gross_pension_contribution" placeholder="Gross contribution amount" style={inputStyle} />
              <input name="net_pension_contribution" placeholder="Net amount paid, if known" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.eis && (
          <section style={cardStyle}>
            <h3>EIS / SEIS / VCT details</h3>
            <textarea name="eis_seis_vct_details" placeholder="Provide investment type, company name and amount invested" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.blindAllowance && (
          <section style={cardStyle}>
            <h3>Blind Person’s Allowance details</h3>
            <textarea name="blind_allowance_details" placeholder="Provide claim details and supporting evidence information" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.marriageAllowance && (
          <section style={cardStyle}>
            <h3>Marriage Allowance details</h3>
            <div style={gridStyle}>
              <input name="spouse_name" placeholder="Spouse / civil partner name" style={inputStyle} />
              <input name="spouse_ni_number" placeholder="Spouse / civil partner NI number" style={inputStyle} />
              <input name="marriage_allowance_direction" placeholder="Transfer to you / transfer from you / not sure" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.studentLoan && (
          <section style={cardStyle}>
            <h3>Student loan details</h3>
            <div style={gridStyle}>
              <input name="student_loan_plan" placeholder="Plan 1 / Plan 2 / Plan 4 / Postgraduate / Not sure" style={inputStyle} />
              <input name="student_loan_repayments" placeholder="Repayments already deducted" style={inputStyle} />
            </div>
          </section>
        )}

        {answers.residence && (
          <section style={cardStyle}>
            <h3>Arrival / departure / residence details</h3>
            <div style={gridStyle}>
              <input name="uk_arrival_date" type="date" style={inputStyle} />
              <input name="uk_departure_date" type="date" style={inputStyle} />
              <input name="days_in_uk" placeholder="Days spent in the UK" style={inputStyle} />
              <input name="country_of_residence" placeholder="Country of residence" style={inputStyle} />
            </div>
            <textarea name="residence_notes" placeholder="Residence, domicile or split-year details" rows={4} style={inputStyle} />
          </section>
        )}

        {answers.taxCode && (
          <section style={cardStyle}>
            <h3>Tax code adjustment details</h3>
            <textarea name="tax_code_details" placeholder="Provide PAYE coding notice details, prior year underpayment, benefits or estimated income adjustments" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.hmrcChanges && (
          <section style={cardStyle}>
            <h3>HMRC record changes</h3>
            <textarea name="hmrc_record_changes" placeholder="Address change, name change, bank changes or HMRC correspondence details" rows={3} style={inputStyle} />
          </section>
        )}

        {answers.otherIncome && (
          <section style={cardStyle}>
            <h3>Other income details</h3>
            <textarea name="other_income_details" placeholder="Provide details of any other taxable income" rows={3} style={inputStyle} />
          </section>
        )}

        <section style={cardStyle}>
          <h3>2. Required documents</h3>

          {requiredDocs.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              Select income/tax areas above to generate your tailored checklist.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {requiredDocs.map((doc) => (
                <div key={doc} style={documentRowStyle}>
                  <strong>{doc}</strong>
                  <select
                    name={`document_status_${doc}`}
                    value={status[doc] || ""}
                    onChange={(event) =>
                      setStatus((previous) => ({
                        ...previous,
                        [doc]: event.target.value,
                      }))
                    }
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
            Please upload your documents to one secure shared folder and paste the link here.
          </p>
        </section>

        <section style={cardStyle}>
          <h3>Your checklist summary</h3>
          <p style={{ color: "#64748b" }}>
            Please review the document checklist above before submitting. Your accountant will review your answers and contact you if anything further is required.
          </p>

          {missingDocs.length > 0 ? (
            <div style={missingStyle}>
              <strong>You have marked the following items as missing:</strong>
              <ul>
                {missingDocs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={successStyle}>
              No missing items have been marked based on your checklist responses.
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h3>Additional notes</h3>
          <textarea name="notes" placeholder="Anything else we should know?" rows={4} style={inputStyle} />
        </section>

        <section style={cardStyle}>
          <h3>Declaration</h3>
          <label>
            <input name="client_declaration" type="checkbox" required /> I confirm that the information provided is complete and accurate to the best of my knowledge.
          </label>
        </section>

        {submitError && <div style={errorStyle}>{submitError}</div>}

        <input type="hidden" name="_subject" value={`Self Assessment Intake Submission - ${firm.name}`} />

        <button type="submit" disabled={submitting} style={buttonStyle(firm.brandColor)}>
          {submitting ? "Submitting..." : "Submit information"}
        </button>
      </form>
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: "1050px",
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "Arial, sans-serif",
  lineHeight: 1.6,
};

const introStyle: CSSProperties = {
  color: "#64748b",
  maxWidth: "780px",
  margin: "10px auto",
};

const cardStyle: CSSProperties = {
  padding: "24px",
  background: "white",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15,23,42,0.06)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
  marginBottom: "12px",
};

const inputStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  width: "100%",
};

const warningStyle: CSSProperties = {
  marginTop: "15px",
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

const documentRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 190px",
  gap: "12px",
  alignItems: "center",
};

const missingStyle: CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  background: "#fee2e2",
  borderRadius: "12px",
  color: "#991b1b",
};

const successStyle: CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  background: "#dcfce7",
  borderRadius: "12px",
  color: "#166534",
};

const errorStyle: CSSProperties = {
  padding: "14px",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: "10px",
};

function buttonStyle(brandColor?: string): CSSProperties {
  return {
    padding: "15px",
    background: brandColor || "#25D366",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "16px",
  };
}
