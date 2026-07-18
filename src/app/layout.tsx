import type { Metadata } from "next";
import Providers from "@/web/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataPilot",
  description: "DataPilot - Data Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
