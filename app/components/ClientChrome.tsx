"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export default function ClientChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideChrome =
    pathname === "/smart-sa-intake" ||
    pathname.startsWith("/app");

  return (
    <>
      {!hideChrome && <SiteHeader />}
      {children}
      {!hideChrome && <SiteFooter />}
    </>
  );
}