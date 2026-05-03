import ClientChrome from "./components/ClientChrome";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UK Tax Calculator 2025/26 | Hala Digital Ltd",
  description:
    "A UK tax calculator and tax tools platform for individuals, businesses and accountancy practices.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientChrome>{children}</ClientChrome>
      </body>
    </html>
  );
}
