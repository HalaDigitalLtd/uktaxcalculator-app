import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function safeSelect(table: string, build: (q: any) => any) {
  try {
    const query = build(supabaseAdmin.from(table).select("*"));
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    let clientId = url.searchParams.get("clientId");
    let taxYearId = url.searchParams.get("taxYearId");

    if (req.method === "POST") {
      const body = await req.json();
      clientId = body.clientId || clientId;
      taxYearId = body.taxYearId || taxYearId;
    }

    if (!clientId || !taxYearId) {
      return NextResponse.json(
        { success: false, error: "Missing clientId or taxYearId." },
        { status: 400 }
      );
    }

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    const { data: taxYear } = await supabaseAdmin
      .from("tax_years")
      .select("*")
      .eq("id", taxYearId)
      .maybeSingle();

    const { data: quarters } = await supabaseAdmin
      .from("quarters")
      .select("*")
      .eq("tax_year_id", taxYearId);

    const logsA = await safeSelect("mtd_submission_logs", (q) =>
      q.eq("client_id", clientId).eq("tax_year_id", taxYearId)
    );

    const logsB = await safeSelect("quarter_submission_logs", (q) =>
      q.eq("client_id", clientId).eq("tax_year_id", taxYearId)
    );

    const { data: workflow } = await supabaseAdmin
      .from("final_declaration_workflows")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .maybeSingle();

    const { data: auditTrail } = await supabaseAdmin
      .from("final_declaration_audit_trail")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      client,
      taxYear,
      quarters: quarters || [],
      submissionLogs: [...logsA, ...logsB],
      workflow,
      auditTrail: auditTrail || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Page data failed." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}