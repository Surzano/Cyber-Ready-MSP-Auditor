import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trust, But Verify — Cyber Ready MSP Security Auditor",
  description:
    "Privacy-first security auditor for nonprofits managed by an MSP: email spoofing & website header scan, identity & license hygiene audit, MSP report card, and copy-paste remediation tickets with a board-ready one-pager.",
  authors: [{ name: "Surzano R. Solomon" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>{children}</body>
    </html>
  );
}
