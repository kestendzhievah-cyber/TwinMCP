import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinMCP",
  description: "TwinMCP — documentation context for AI coding agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
