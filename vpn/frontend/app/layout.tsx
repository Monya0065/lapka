import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lapka VPN",
  description: "Secure VPN with Telegram activation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}