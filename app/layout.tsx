"use client";

import { usePathname } from "next/navigation";

export default function ClientChrome({
  children,
  header,
  footer,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideChrome = pathname === "/smart-sa-intake";

  return (
    <>
      {!hideChrome && header}
      {children}
      {!hideChrome && footer}
    </>
  );
}
