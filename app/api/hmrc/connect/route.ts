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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = body?.clientId ? String(body.clientId) : null;

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required for client HMRC authorisation." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, firm_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !client?.firm_id) {
      return NextResponse.json(
        { error: "Client not found for HMRC connection." },
        { status: 404 }
      );
    }

    const { data: firmUser, error: firmUserError } = await supabaseAdmin
      .from("firm_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("firm_id", client.firm_id)
      .eq("status", "active")
      .maybeSingle();

    if (firmUserError || !firmUser) {
      return NextResponse.json(
        { error: "You do not have access to this client's firm workspace." },
        { status: 403 }
      );
    }

    const state = crypto.randomBytes(32).toString("hex");

    const { error: stateError } = await supabaseAdmin
      .from("hmrc_oauth_states")
      .insert({
        state,
        firm_id: client.firm_id,
        user_id: user.id,
        client_id: clientId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      return NextResponse.json(
        { error: "Failed to create OAuth state", details: stateError.message },
        { status: 500 }
      );
    }

    const authUrl = new URL(process.env.HMRC_AUTH_URL!);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", process.env.HMRC_CLIENT_ID!);
    authUrl.searchParams.set("redirect_uri", process.env.HMRC_REDIRECT_URI!);
    authUrl.searchParams.set("scope", "read:self-assessment write:self-assessment");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      firmId: client.firm_id,
      clientId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}