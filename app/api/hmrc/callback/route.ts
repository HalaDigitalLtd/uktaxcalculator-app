import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    console.log("HMRC CALLBACK HIT:", req.url);

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    console.log("HMRC CALLBACK CODE EXISTS:", !!code);
    console.log("HMRC CALLBACK STATE:", state);
    console.log("HMRC CALLBACK ERROR:", error);

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings?hmrc=error&message=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing HMRC code or state" },
        { status: 400 }
      );
    }

    const { data: savedState, error: stateError } = await supabaseAdmin
      .from("hmrc_oauth_states")
      .select("*")
      .eq("state", state)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    console.log("SAVED STATE:", savedState);
    console.log("STATE ERROR:", stateError);

    if (stateError || !savedState) {
      return NextResponse.json(
        { error: "Invalid or expired OAuth state" },
        { status: 400 }
      );
    }

    const tokenResponse = await fetch(process.env.HMRC_TOKEN_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HMRC_CLIENT_ID || "",
        client_secret: process.env.HMRC_CLIENT_SECRET || "",
        redirect_uri: process.env.HMRC_REDIRECT_URI || "",
        code,
      }),
    });

    const tokenText = await tokenResponse.text();

    let tokenData: any = {};
    try {
      tokenData = tokenText ? JSON.parse(tokenText) : {};
    } catch {
      tokenData = { raw: tokenText };
    }

    console.log("HMRC TOKEN STATUS:", tokenResponse.status);
    console.log("HMRC TOKEN DATA:", tokenData);

    if (!tokenResponse.ok) {
      return NextResponse.json(
        {
          error: "HMRC token exchange failed",
          status: tokenResponse.status,
          details: tokenData,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(
      Date.now() + Number(tokenData.expires_in || 14400) * 1000
    ).toISOString();

    const { error: saveError } = await supabaseAdmin
      .from("hmrc_connections")
      .upsert(
        {
          firm_id: savedState.firm_id,
          user_id: savedState.user_id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          scope: tokenData.scope,
          token_type: tokenData.token_type,
          expires_at: expiresAt,
          environment: process.env.HMRC_ENVIRONMENT || "sandbox",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "firm_id,environment",
        }
      );

    console.log("HMRC SAVE ERROR:", saveError);

    if (saveError) {
      return NextResponse.json(
        {
          error: "Failed to save HMRC connection",
          details: saveError,
        },
        { status: 500 }
      );
    }

    const { error: usedError } = await supabaseAdmin
      .from("hmrc_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state", state);

    console.log("HMRC STATE USED ERROR:", usedError);

    return NextResponse.redirect(
      new URL("/dashboard/settings?hmrc=connected", req.url)
    );
  } catch (error: any) {
    console.error("HMRC CALLBACK FATAL ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "HMRC callback failed",
      },
      { status: 500 }
    );
  }
}