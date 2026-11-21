import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", variable: "--font-display" });
const bodyFont = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: "Seila — Style your next adventure",
  description:
    "Seila is a fashion discovery and travel-inspired styling experience. Join the waitlist for launch news.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
