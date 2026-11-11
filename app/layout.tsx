import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loomi Live",
  description: "Loomi Live - Public Chat, Mansion VIP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black">{children}</body>
    </html>
  );
}
