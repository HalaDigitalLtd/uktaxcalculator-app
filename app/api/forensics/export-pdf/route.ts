import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { buildSnapshotEvidencePack } from "../../../../lib/forensics/buildSnapshotEvidencePack";

export async function GET(req: NextRequest) {
  try {
    const snapshotId = req.nextUrl.searchParams.get("snapshotId");

    if (!snapshotId) {
      return NextResponse.json(
        { error: "snapshotId required" },
        { status: 400 }
      );
    }

    const { data: snapshot, error } = await supabaseAdmin
      .from("hmrc_submission_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .single();

    if (error || !snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    const evidencePack = buildSnapshotEvidencePack(snapshot);

    return new NextResponse(evidencePack.evidencePdfHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="evidence-${snapshotId}.html"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Export failed",
      },
      { status: 500 }
    );
  }
}