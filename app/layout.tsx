"use client";

import { usePathname } from "next/navigation";

export default function ClientChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/smart-sa-intake") {
    const childrenArray = Array.isArray(children) ? children : [children];

    return <>{childrenArray[1]}</>;
  }

  return <>{children}</>;
}
