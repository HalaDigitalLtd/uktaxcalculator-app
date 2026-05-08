"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  utr: string;
  nino: string;
  client_type: string;
  hmrc_authorisation_status: string;
  mtd_income_tax_id: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  business_name: string;
  client_reference: string;
  vat_registration_number: string;
  vat_registration_date: string;
  eori_number: string;
  group_identifier: string;
  notes: string;
};

const initialForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  utr: "",
  nino: "",
  client_type: "self-employment",
  hmrc_authorisation_status: "unknown",
  mtd_income_tax_id: "",
  date_of_birth: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  business_name: "",
  client_reference: "",
  vat_registration_number: "",
  vat_registration_date: "",
  eori_number: "",
  group_identifier: "",
  notes: "",
};

function cleanNino(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function cleanText(value: string) {
  return value.trim();
}

export default function AddClientPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddClient = async () => {
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        alert("Please login first");
        router.push("/auth/login");
        return;
      }

      const { data: firmUser, error: firmError } = await supabase
        .from("firm_users")
        .select("firm_id")
        .eq("user_id", userData.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (firmError || !firmUser?.firm_id) {
        alert("Firm not found for this user.");
        return;
      }

      if (!cleanText(form.first_name) || !cleanText(form.last_name)) {
        alert("First name and last name are required.");
        return;
      }

      if (!cleanText(form.nino) && !cleanText(form.utr)) {
        alert("Please enter at least NINO or UTR.");
        return;
      }

      const payload = {
        firm_id: firmUser.firm_id,

        first_name: cleanText(form.first_name),
        last_name: cleanText(form.last_name),
        email: cleanText(form.email) || null,
        phone: cleanText(form.phone) || null,

        client_email: cleanText(form.email) || null,
        client_phone: cleanText(form.phone) || null,

        utr: cleanText(form.utr) || null,
        nino: cleanNino(form.nino) || null,
        client_type: form.client_type,
        hmrc_income_source_type: form.client_type,
        mtd_status: form.hmrc_authorisation_status,
        hmrc_authorisation_status: form.hmrc_authorisation_status,

        mtd_income_tax_id: cleanText(form.mtd_income_tax_id) || null,
        date_of_birth: form.date_of_birth || null,

        address_line1: cleanText(form.address_line1) || null,
        address_line2: cleanText(form.address_line2) || null,
        city: cleanText(form.city) || null,
        postcode: cleanText(form.postcode).toUpperCase() || null,

        business_name: cleanText(form.business_name) || null,
        client_reference: cleanText(form.client_reference) || null,

        vat_registration_number:
          cleanText(form.vat_registration_number) || null,
        vat_registration_date: form.vat_registration_date || null,
        eori_number: cleanText(form.eori_number) || null,
        group_identifier: cleanText(form.group_identifier) || null,
        notes: cleanText(form.notes) || null,

        hmrc_connected: form.hmrc_authorisation_status === "authorised",
        hmrc_environment: "sandbox",
      };

      const { error } = await supabase.from("clients").insert(payload);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Client added successfully");
      router.push("/app/clients");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 6,
    display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 22,
    marginBottom: 20,
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 36 }}>
      <button
        onClick={() => router.push("/app/clients")}
        style={{
          background: "transparent",
          border: "none",
          color: "#2563eb",
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        ← Back to clients
      </button>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, marginBottom: 6 }}>Add Client</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Add an MTD ITSA client. Do not store client Government Gateway
          passwords in this system.
        </p>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Personal details</h2>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>First name *</label>
              <input
                style={inputStyle}
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Last name *</label>
              <input
                style={inputStyle}
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Date of birth</label>
              <input
                style={inputStyle}
                type="date"
                value={form.date_of_birth}
                onChange={(e) => update("date_of_birth", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>HMRC identifiers</h2>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>NINO *</label>
              <input
                style={inputStyle}
                placeholder="SN456269C"
                value={form.nino}
                onChange={(e) => update("nino", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Self Assessment UTR *</label>
              <input
                style={inputStyle}
                placeholder="3702705753"
                value={form.utr}
                onChange={(e) => update("utr", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>MTD Income Tax ID</label>
              <input
                style={inputStyle}
                placeholder="XEIT00819080544"
                value={form.mtd_income_tax_id}
                onChange={(e) => update("mtd_income_tax_id", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Income source</label>
              <select
                style={inputStyle}
                value={form.client_type}
                onChange={(e) => update("client_type", e.target.value)}
              >
                <option value="self-employment">Self-employment</option>
                <option value="uk-property">UK property</option>
                <option value="both">Self-employment + UK property</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>HMRC authorisation status</label>
              <select
                style={inputStyle}
                value={form.hmrc_authorisation_status}
                onChange={(e) =>
                  update("hmrc_authorisation_status", e.target.value)
                }
              >
                <option value="unknown">Unknown</option>
                <option value="authorised">Authorised</option>
                <option value="not_authorised">Not authorised</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Address</h2>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Address line 1</label>
              <input
                style={inputStyle}
                value={form.address_line1}
                onChange={(e) => update("address_line1", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Address line 2</label>
              <input
                style={inputStyle}
                value={form.address_line2}
                onChange={(e) => update("address_line2", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>City / town</label>
              <input
                style={inputStyle}
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Postcode</label>
              <input
                style={inputStyle}
                value={form.postcode}
                onChange={(e) => update("postcode", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Business / optional identifiers</h2>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Business name</label>
              <input
                style={inputStyle}
                value={form.business_name}
                onChange={(e) => update("business_name", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Client reference</label>
              <input
                style={inputStyle}
                value={form.client_reference}
                onChange={(e) => update("client_reference", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>VAT registration number</label>
              <input
                style={inputStyle}
                value={form.vat_registration_number}
                onChange={(e) =>
                  update("vat_registration_number", e.target.value)
                }
              />
            </div>

            <div>
              <label style={labelStyle}>VAT registration date</label>
              <input
                style={inputStyle}
                type="date"
                value={form.vat_registration_date}
                onChange={(e) =>
                  update("vat_registration_date", e.target.value)
                }
              />
            </div>

            <div>
              <label style={labelStyle}>EORI number</label>
              <input
                style={inputStyle}
                value={form.eori_number}
                onChange={(e) => update("eori_number", e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Group identifier</label>
              <input
                style={inputStyle}
                value={form.group_identifier}
                onChange={(e) => update("group_identifier", e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </section>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={() => router.push("/app/clients")}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleAddClient}
            disabled={loading}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#94a3b8" : "#0f172a",
              color: "white",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save client"}
          </button>
        </div>
      </div>
    </main>
  );
}