import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/register?verified=missing-token", req.url)
      );
    }

    const tokenHash = hashToken(token);

    const { data: registration, error } = await supabaseAdmin
      .from("onboarding_registrations")
      .select("*")
      .eq("verification_token_hash", tokenHash)
      .maybeSingle();

    if (error || !registration) {
      return NextResponse.redirect(
        new URL("/auth/register?verified=invalid-token", req.url)
      );
    }

    if (registration.workspace_provisioned_at) {
      return NextResponse.redirect(new URL("/dashboard/clients", req.url));
    }

    if (
      registration.verification_expires_at &&
      new Date(registration.verification_expires_at).getTime() < Date.now()
    ) {
      await supabaseAdmin
        .from("onboarding_registrations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
          metadata: {
            ...(registration.metadata || {}),
            expired_reason: "email_verification_token_expired",
            expired_at: new Date().toISOString(),
          },
        })
        .eq("id", registration.id);

      return NextResponse.redirect(
        new URL("/auth/register?verified=expired", req.url)
      );
    }

    if (!registration.email_verified_at) {
      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("onboarding_registrations")
        .update({
          email_verified_at: now,
          status: "email_verified",
          verification_token_hash: null,
          metadata: {
            ...(registration.metadata || {}),
            email_verified_at: now,
          },
        })
        .eq("id", registration.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (registration.auth_user_id) {
        await supabaseAdmin.auth.admin.updateUserById(registration.auth_user_id, {
          email_confirm: true,
        });
      }
    }

    return NextResponse.redirect(
      new URL(`/auth/register?verified=success&registration=${registration.id}`, req.url)
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL("/auth/register?verified=error", req.url)
    );
  }
}
