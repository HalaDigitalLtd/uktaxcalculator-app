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
  const [message, setMessage] = useState("");

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddClient = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/auth/login");
        return;
      }

      const impersonatedFirmId =
        typeof window !== "undefined"
          ? localStorage.getItem("impersonate_firm_id")
          : null;

      const { data: firmId, error: firmResolveError } = await supabase.rpc(
        "get_current_active_firm_id",
        {
          impersonated_firm_id: impersonatedFirmId || null,
        }
      );

      if (firmResolveError || !firmId) {
        setMessage(
          firmResolveError?.message ||
            "Your account is not linked to an active firm workspace."
        );
        return;
      }

      if (!cleanText(form.first_name) || !cleanText(form.last_name)) {
        setMessage("First name and last name are required.");
        return;
      }

      if (!cleanText(form.nino) && !cleanText(form.utr)) {
        setMessage("Please enter at least NINO or UTR.");
        return;
      }

      const payload = {
        firm_id: firmId,
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
        vat_registration_number: cleanText(form.vat_registration_number) || null,
        vat_registration_date: form.vat_registration_date || null,
        eori_number: cleanText(form.eori_number) || null,
        group_identifier: cleanText(form.group_identifier) || null,
        notes: cleanText(form.notes) || null,
        hmrc_connected: form.hmrc_authorisation_status === "authorised",
        hmrc_environment: "sandbox",
        archived_at: null,
        archived_by: null,
      };

      const { data: insertedClient, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push(
  insertedClient?.id
    ? `/dashboard/clients/${insertedClient.id}`
    : "/dashboard/clients"
);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 36 }}>
      <button onClick={() => router.push("/dashboard/clients")} style={backButton}>
        ← Back to clients
      </button>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, marginBottom: 6 }}>Add Client</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Add an MTD ITSA client. Do not store client Government Gateway passwords in this system.
        </p>

        {message && <div style={messageStyle}>{message}</div>}

        <Section title="Personal details">
          <Grid>
            <Field label="First name *" value={form.first_name} onChange={(v) => update("first_name", v)} />
            <Field label="Last name *" value={form.last_name} onChange={(v) => update("last_name", v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => update("date_of_birth", v)} />
          </Grid>
        </Section>

        <Section title="HMRC identifiers">
          <Grid>
            <Field label="NINO" placeholder="SN456269C" value={form.nino} onChange={(v) => update("nino", v)} />
            <Field label="Self Assessment UTR" placeholder="3702705753" value={form.utr} onChange={(v) => update("utr", v)} />
            <Field label="MTD Income Tax ID" placeholder="XEIT00819080544" value={form.mtd_income_tax_id} onChange={(v) => update("mtd_income_tax_id", v)} />

            <div>
              <label style={labelStyle}>Income source</label>
              <select style={inputStyle} value={form.client_type} onChange={(e) => update("client_type", e.target.value)}>
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
                onChange={(e) => update("hmrc_authorisation_status", e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="authorised">Authorised</option>
                <option value="not_authorised">Not authorised</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </Grid>
        </Section>

        <Section title="Address">
          <Grid>
            <Field label="Address line 1" value={form.address_line1} onChange={(v) => update("address_line1", v)} />
            <Field label="Address line 2" value={form.address_line2} onChange={(v) => update("address_line2", v)} />
            <Field label="City / town" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Postcode" value={form.postcode} onChange={(v) => update("postcode", v)} />
          </Grid>
        </Section>

        <Section title="Business / optional identifiers">
          <Grid>
            <Field label="Business name" value={form.business_name} onChange={(v) => update("business_name", v)} />
            <Field label="Client reference" value={form.client_reference} onChange={(v) => update("client_reference", v)} />
            <Field label="VAT registration number" value={form.vat_registration_number} onChange={(v) => update("vat_registration_number", v)} />
            <Field label="VAT registration date" type="date" value={form.vat_registration_date} onChange={(v) => update("vat_registration_date", v)} />
            <Field label="EORI number" value={form.eori_number} onChange={(v) => update("eori_number", v)} />
            <Field label="Group identifier" value={form.group_identifier} onChange={(v) => update("group_identifier", v)} />
          </Grid>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </Section>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/dashboard/clients")} style={cancelButton}>
            Cancel
          </button>

          <button onClick={handleAddClient} disabled={loading} style={saveButton(loading)}>
            {loading ? "Saving..." : "Save client"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={gridStyle}>{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

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

const backButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#2563eb",
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 18,
};

const messageStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  padding: "14px 16px",
  borderRadius: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const cancelButton: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const saveButton = (loading: boolean): React.CSSProperties => ({
  padding: "12px 18px",
  borderRadius: 10,
  border: "none",
  background: loading ? "#94a3b8" : "#0f172a",
  color: "white",
  fontWeight: 900,
  cursor: loading ? "not-allowed" : "pointer",
});