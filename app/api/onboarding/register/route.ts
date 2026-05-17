import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function originFromRequest(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    "http://localhost:3000"
  );
}

function verificationExpiry() {
  const date = new Date();
  date.setHours(date.getHours() + 24);
  return date.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = cleanEmail(body.email);
    const password = String(body.password || "");
    const firmName = String(body.firmName || "").trim();
    const authorisedContactName = String(body.authorisedContactName || "").trim();

    const phone = String(body.phone || "").trim() || null;
    const professionalBody = String(body.professionalBody || "").trim() || null;
    const practiceType = String(body.practiceType || "").trim() || null;
    const estimatedClientCount = String(body.estimatedClientCount || "").trim() || null;
    const country = String(body.country || "United Kingdom").trim();

    if (!email || !password || !firmName || !authorisedContactName) {
      return NextResponse.json(
        { success: false, message: "Missing required registration details." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const { data: existingOpen, error: existingOpenError } = await supabaseAdmin
      .from("onboarding_registrations")
      .select("id,status,email_verified_at,workspace_provisioned_at")
      .eq("email", email)
      .is("workspace_provisioned_at", null)
      .not("status", "in", "(cancelled,expired,failed)")
      .maybeSingle();

    if (existingOpenError) {
      throw new Error(existingOpenError.message);
    }

    if (existingOpen?.id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "An onboarding registration already exists for this email. Please verify your email or continue checkout.",
        },
        { status: 409 }
      );
    }

    const { data: userList, error: listUsersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listUsersError) {
      throw new Error(listUsersError.message);
    }

    const alreadyExists = userList?.users?.some(
      (user) => cleanEmail(user.email || "") === email
    );

    if (alreadyExists) {
      return NextResponse.json(
        {
          success: false,
          message: "An account already exists for this email. Please login instead.",
        },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          source: "hala_digital_onboarding",
          firm_name: firmName,
          authorised_contact_name: authorisedContactName,
        },
      });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Unable to create account.");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const origin = originFromRequest(req);
    const now = new Date().toISOString();

    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("onboarding_registrations")
      .insert({
        email,
        firm_name: firmName,
        authorised_contact_name: authorisedContactName,
        phone,
        professional_body: professionalBody,
        practice_type: practiceType,
        estimated_client_count: estimatedClientCount,
        country,
        auth_user_id: authData.user.id,
        status: "email_verification_pending",
        payment_status: "not_started",
        provisioning_status: "not_started",
        verification_token_hash: tokenHash,
        verification_sent_at: now,
        verification_expires_at: verificationExpiry(),
        ip_address:
          req.headers.get("x-forwarded-for") ||
          req.headers.get("x-real-ip") ||
          null,
        user_agent: req.headers.get("user-agent"),
        metadata: {
          source: "public_signup",
          onboarding_version: 2,
          free_trial: false,
          payment_required_before_workspace: true,
          registered_at: now,
        },
      })
      .select("id")
      .single();

    if (registrationError || !registration) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(
        registrationError?.message || "Unable to create onboarding registration."
      );
    }

    const verificationUrl = `${origin}/api/onboarding/verify-email?token=${token}`;

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      message: "Registration created. Please verify your email before checkout.",
      verificationUrl:
        process.env.NODE_ENV === "development" ? verificationUrl : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Registration failed.",
      },
      { status: 500 }
    );
  }
}
