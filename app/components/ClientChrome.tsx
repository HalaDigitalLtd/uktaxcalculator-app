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

  const isIntakePage = pathname === "/smart-sa-intake";

  return (
    <>
      {!isIntakePage && <SiteHeader />}
      {children}
      {!isIntakePage && <SiteFooter />}
    </>
  );
}
