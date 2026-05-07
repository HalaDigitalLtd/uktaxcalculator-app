"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabaseClient";

export default function AddTaxYearPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  const [yearLabel, setYearLabel] = useState("");

  const handleAdd = async () => {
    if (!yearLabel.includes("-")) {
      alert("Use format like 2025-26");
      return;
    }

    const startYear = parseInt(yearLabel.split("-")[0]);

    const { data: newYear, error } = await supabase
      .from("tax_years")
      .insert([
        {
          client_id: clientId,
          year_label: yearLabel,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (newYear) {
      const { error: quartersError } = await supabase.from("quarters").insert([
        {
          tax_year_id: newYear.id,
          quarter_name: "Q1",
          start_date: `${startYear}-04-06`,
          end_date: `${startYear}-07-05`,
          status: "not_started",
        },
        {
          tax_year_id: newYear.id,
          quarter_name: "Q2",
          start_date: `${startYear}-07-06`,
          end_date: `${startYear}-10-05`,
          status: "not_started",
        },
        {
          tax_year_id: newYear.id,
          quarter_name: "Q3",
          start_date: `${startYear}-10-06`,
          end_date: `${startYear + 1}-01-05`,
          status: "not_started",
        },
        {
          tax_year_id: newYear.id,
          quarter_name: "Q4",
          start_date: `${startYear + 1}-01-06`,
          end_date: `${startYear + 1}-04-05`,
          status: "not_started",
        },
      ]);

      if (quartersError) {
        alert(quartersError.message);
        return;
      }
    }

    alert("Tax year + correct HMRC quarters added");
    router.push(`/app/clients/${clientId}`);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Add Tax Year</h1>

      <input
        placeholder="e.g. 2025-26"
        value={yearLabel}
        onChange={(e) => setYearLabel(e.target.value)}
      />

      <br /><br />

      <button onClick={handleAdd}>Add</button>
    </div>
  );
}