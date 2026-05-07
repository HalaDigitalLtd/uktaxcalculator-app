"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function AddClientPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [utr, setUtr] = useState("");
  const [nino, setNino] = useState("");
  const [clientType, setClientType] = useState("sole_trader");

  const handleAddClient = async () => {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      alert("Please login first");
      router.push("/auth/login");
      return;
    }

    const { data: firmUser } = await supabase
      .from("firm_users")
      .select("firm_id")
      .eq("user_id", userData.user.id)
      .single();

    if (!firmUser) {
      alert("Firm not found");
      return;
    }

    const { error } = await supabase.from("clients").insert([
      {
        firm_id: firmUser.firm_id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        utr,
        nino,
        client_type: clientType,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Client added successfully");
    router.push("/app/clients");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Add Client</h1>

      <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      <br /><br />

      <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <br /><br />

      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <br /><br />

      <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <br /><br />

      <input placeholder="UTR" value={utr} onChange={(e) => setUtr(e.target.value)} />
      <br /><br />

      <input placeholder="NINO" value={nino} onChange={(e) => setNino(e.target.value)} />
      <br /><br />

      <select value={clientType} onChange={(e) => setClientType(e.target.value)}>
        <option value="sole_trader">Sole Trader</option>
        <option value="landlord">Landlord</option>
        <option value="both">Sole Trader + Landlord</option>
      </select>

      <br /><br />

      <button onClick={handleAddClient}>Add Client</button>
    </div>
  );
}