"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabaseClient";

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();

  const clientId = params.clientId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    nino: "",
    utr: "",
    business_name: "",
    client_reference: "",
    hmrc_income_source_type: "",
    mtd_income_tax_id: "",
    vat_registration_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    notes: "",
  });

  const loadClient = async () => {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      window.location.href = "/auth/login";
      return;
    }

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: activeFirmId } = await supabase.rpc(
      "get_current_active_firm_id",
      {
        impersonated_firm_id: impersonatedFirmId || null,
      }
    );

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("firm_id", activeFirmId)
      .maybeSingle();

    if (error || !data) {
      setMessage(error?.message || "Client not found.");
      setLoading(false);
      return;
    }

    setForm({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      email: data.email || "",
      phone: data.phone || "",
      nino: data.nino || "",
      utr: data.utr || "",
      business_name: data.business_name || "",
      client_reference: data.client_reference || "",
      hmrc_income_source_type:
        data.hmrc_income_source_type || "",
      mtd_income_tax_id: data.mtd_income_tax_id || "",
      vat_registration_number:
        data.vat_registration_number || "",
      address_line1: data.address_line1 || "",
      address_line2: data.address_line2 || "",
      city: data.city || "",
      postcode: data.postcode || "",
      notes: data.notes || "",
    });

    setLoading(false);
  };

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const saveClient = async () => {
    setSaving(true);
    setMessage("");

    const impersonatedFirmId =
      typeof window !== "undefined"
        ? localStorage.getItem("impersonate_firm_id")
        : null;

    const { data: activeFirmId } = await supabase.rpc(
      "get_current_active_firm_id",
      {
        impersonated_firm_id: impersonatedFirmId || null,
      }
    );

    const payload = {
      ...form,
      nino: form.nino.replace(/\s+/g, "").toUpperCase(),
      postcode: form.postcode.toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", clientId)
      .eq("firm_id", activeFirmId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.push(`/app/clients/${clientId}`);
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>Loading client...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <Link
              href={`/app/clients/${clientId}`}
              style={styles.backLink}
            >
              ← Back to client
            </Link>

            <h1 style={styles.title}>Edit Client</h1>
          </div>

          <button
            onClick={saveClient}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.grid}>
            <Input
              label="First name"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
            />

            <Input
              label="Last name"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
            />

            <Input
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
            />

            <Input
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            <Input
              label="NINO"
              name="nino"
              value={form.nino}
              onChange={handleChange}
            />

            <Input
              label="UTR"
              name="utr"
              value={form.utr}
              onChange={handleChange}
            />

            <Input
              label="Business name"
              name="business_name"
              value={form.business_name}
              onChange={handleChange}
            />

            <Input
              label="Client reference"
              name="client_reference"
              value={form.client_reference}
              onChange={handleChange}
            />

            <div style={styles.field}>
              <label style={styles.label}>
                Income source
              </label>

              <select
                name="hmrc_income_source_type"
                value={form.hmrc_income_source_type}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="">Select</option>
                <option value="self-employment">
                  Self Employment
                </option>
                <option value="property">
                  Property
                </option>
                <option value="partnership">
                  Partnership
                </option>
              </select>
            </div>

            <Input
              label="MTD Income Tax ID"
              name="mtd_income_tax_id"
              value={form.mtd_income_tax_id}
              onChange={handleChange}
            />

            <Input
              label="VAT number"
              name="vat_registration_number"
              value={form.vat_registration_number}
              onChange={handleChange}
            />

            <Input
              label="Address line 1"
              name="address_line1"
              value={form.address_line1}
              onChange={handleChange}
            />

            <Input
              label="Address line 2"
              name="address_line2"
              value={form.address_line2}
              onChange={handleChange}
            />

            <Input
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
            />

            <Input
              label="Postcode"
              name="postcode"
              value={form.postcode}
              onChange={handleChange}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={styles.label}>Notes</label>

            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              style={styles.textarea}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  ...props
}: any) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        {label}
      </label>

      <input
        {...props}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 32,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  },
  title: {
    margin: "10px 0 0",
    fontSize: 34,
    fontWeight: 900,
  },
  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 18,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontWeight: 700,
    fontSize: 14,
    color: "#334155",
  },
  input: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: 14,
    fontSize: 14,
  },
  saveButton: {
    background: "#020617",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  message: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontWeight: 700,
  },
};