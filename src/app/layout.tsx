import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "MSP Auditor — a security check-up for nonprofits and their MSPs",
  description:
    "Check whether your MSP is actually protecting you: email spoofing and website header scan, identity and license audit, MSP report card, and ready-to-send help desk tickets with a one-page board briefing. Your user list never leaves your browser.",
  authors: [{ name: "Surzano R. Solomon" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables go on <html> so the :root theme tokens in globals.css can resolve them.
    <html lang="en" className={`${atkinson.variable} ${bricolage.variable} ${plexMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
