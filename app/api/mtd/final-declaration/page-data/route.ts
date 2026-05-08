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

    if (error) {
      console.error(`safeSelect failed for ${table}:`, error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error(`safeSelect crash for ${table}:`, err);
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
        {
          success: false,
          error: "Missing clientId or taxYearId.",
        },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      return NextResponse.json(
        {
          success: false,
          error: clientError.message,
        },
        { status: 500 }
      );
    }

    const { data: taxYear, error: taxYearError } = await supabaseAdmin
      .from("tax_years")
      .select("*")
      .eq("id", taxYearId)
      .maybeSingle();

    if (taxYearError) {
      return NextResponse.json(
        {
          success: false,
          error: taxYearError.message,
        },
        { status: 500 }
      );
    }

    const { data: quarters, error: quarterError } = await supabaseAdmin
      .from("quarters")
      .select("*")
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: true });

    if (quarterError) {
      return NextResponse.json(
        {
          success: false,
          error: quarterError.message,
        },
        { status: 500 }
      );
    }

    const logsA = await safeSelect("mtd_submission_logs", (q) =>
      q.eq("client_id", clientId).eq("tax_year_id", taxYearId)
    );

    const logsB = await safeSelect("quarter_submission_logs", (q) =>
      q.eq("client_id", clientId).eq("tax_year_id", taxYearId)
    );

    const { data: finalDeclaration, error: finalDeclarationError } =
      await supabaseAdmin
        .from("tax_year_final_declarations")
        .select("*")
        .eq("client_id", clientId)
        .eq("tax_year_id", taxYearId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (finalDeclarationError) {
      return NextResponse.json(
        {
          success: false,
          error: finalDeclarationError.message,
        },
        { status: 500 }
      );
    }

    const { data: auditTrail, error: auditError } = await supabaseAdmin
      .from("final_declaration_audit_trail")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year_id", taxYearId)
      .order("created_at", { ascending: false });

    if (auditError) {
      return NextResponse.json(
        {
          success: false,
          error: auditError.message,
        },
        { status: 500 }
      );
    }

    const { data: amendments } = await supabaseAdmin
      .from("tax_year_amendments")
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

      finalDeclaration: finalDeclaration || null,

      workflow: finalDeclaration || null,

      amendments: amendments || [],

      auditTrail: auditTrail || [],
    });
  } catch (err: any) {
    console.error("Final declaration page-data route failed:", err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Page data failed.",
      },
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