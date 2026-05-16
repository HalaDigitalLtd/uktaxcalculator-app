import { NextRequest, NextResponse } from "next/server";

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function isAppSubdomain(host: string) {
  return host.startsWith("app.haladigital.co.uk");
}

function isMarketingDomain(host: string) {
  return host === "haladigital.co.uk" || host === "www.haladigital.co.uk";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isMarketingDomain(host)) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/app")) {
      return NextResponse.redirect(
        new URL("https://app.haladigital.co.uk/auth/login")
      );
    }

    return NextResponse.next();
  }

  if (isAppSubdomain(host)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};
