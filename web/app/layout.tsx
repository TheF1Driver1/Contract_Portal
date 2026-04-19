import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContractOS — Landlord Contract Manager",
  description: "Modern contract management for landlords",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
