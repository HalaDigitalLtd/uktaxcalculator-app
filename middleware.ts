import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/privacy",
  "/terms",
  "/contact",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasSupabaseAuth =
    request.cookies
      .getAll()
      .some((cookie) => cookie.name.includes("sb-")) || false;

  const isPublic = isPublicPath(pathname);

  if (!hasSupabaseAuth && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (
    hasSupabaseAuth &&
    (pathname === "/auth/login" || pathname === "/auth/register")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};
