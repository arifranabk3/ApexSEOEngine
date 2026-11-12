import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "ApexSEO Autonomous Engine — Phase 01 Master Foundation",
  description:
    "Zero-cost, provider-independent AI SEO & Google AdSense Compliance Automation Platform powered by PostgreSQL, Ollama, n8n Community Edition, and modular CMS adapters."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen font-sans bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 selection:bg-blue-500/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
