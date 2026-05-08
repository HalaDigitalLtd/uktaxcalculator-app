import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deprecated compatibility route.
 *
 * This route used to run a separate legacy final declaration submission engine
 * backed by final_declaration_workflows.
 *
 * Permanent architecture:
 * - tax_year_final_declarations is the canonical workflow authority
 * - /api/hmrc/submit-final-declaration is the canonical HMRC final submission route
 * - hmrc_submission_logs is the immutable HMRC evidence ledger
 *
 * Do not reintroduce HMRC submission logic here.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      error:
        "This legacy final declaration submission endpoint has been retired. Use /api/hmrc/submit-final-declaration.",
      canonicalEndpoint: "/api/hmrc/submit-final-declaration",
      canonicalWorkflowTable: "tax_year_final_declarations",
      immutableEvidenceTable: "hmrc_submission_logs",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      deprecated: true,
      error:
        "This legacy final declaration submission endpoint has been retired. Use /api/hmrc/submit-final-declaration.",
      canonicalEndpoint: "/api/hmrc/submit-final-declaration",
      canonicalWorkflowTable: "tax_year_final_declarations",
      immutableEvidenceTable: "hmrc_submission_logs",
    },
    { status: 410 }
  );
}