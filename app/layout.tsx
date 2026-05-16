import ClientChrome from "./components/ClientChrome";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hala Digital Accountant OS",
  description:
    "Enterprise accountant operating system for HMRC workflows, MTD ITSA, compliance, billing and practice operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <ClientChrome>{children}</ClientChrome>
      </body>
    </html>
  );
}
