import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SystemFit Advisor",
  description: "Local-first system compatibility analysis for software installation decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

