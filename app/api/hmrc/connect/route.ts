import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Use dashboard HMRC connect page instead." },
    { status: 405 }
  );
}

async function isHalaAdminUser(userId: string, email: string | undefined) {
  if (!email) return false;

  const { data, error } = await supabaseAdmin
    .from("app_admins")
    .select("*")
    .eq("email", email)
    .limit(1);

  if (error) {
    console.error("Direct app_admins check failed:", error);
    return false;
  }

  return Boolean(data && data.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid user session" },
        { status: 401 }
      );
    }

    let body: any = {};

    try {
      const requestText = await req.text();
      body = requestText ? JSON.parse(requestText) : {};
    } catch {
      body = {};
    }

    const requestedFirmId = body.firmId || body.firm_id || null;
    const userEmail = user.email || "";

    let resolvedFirmId: string | null = null;

    const adminOk = await isHalaAdminUser(user.id, userEmail);

    if (requestedFirmId && adminOk) {
      const { data: firmData, error: firmError } = await supabaseAdmin
        .from("firms")
        .select("id")
        .eq("id", requestedFirmId)
        .maybeSingle();

      if (firmError || !firmData?.id) {
        return NextResponse.json(
          { error: "Requested firm not found." },
          { status: 404 }
        );
      }

      resolvedFirmId = firmData.id;
    }

    if (!resolvedFirmId) {
      const { data: firmUser, error: firmError } = await supabaseAdmin
        .from("firm_users")
        .select("firm_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (firmError || !firmUser?.firm_id) {
        return NextResponse.json(
          {
            error:
              "Firm not found for user. If using admin mode, select a firm from /admin/firms first.",
          },
          { status: 400 }
        );
      }

      resolvedFirmId = firmUser.firm_id;
    }

    const state = crypto.randomBytes(32).toString("hex");

    const { error: stateError } = await supabaseAdmin
      .from("hmrc_oauth_states")
      .insert({
        state,
        firm_id: resolvedFirmId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error("OAuth state insert error:", stateError);

      return NextResponse.json(
        { error: "Failed to create OAuth state" },
        { status: 500 }
      );
    }

    const authUrl = new URL(process.env.HMRC_AUTH_URL!);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", process.env.HMRC_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", process.env.HMRC_REDIRECT_URI!);
    authUrl.searchParams.set(
      "scope",
      "read:self-assessment write:self-assessment"
    );
    authUrl.searchParams.set("state", state);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      firmId: resolvedFirmId,
      adminMode: adminOk,
    });
  } catch (error: any) {
    console.error("HMRC connect error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}