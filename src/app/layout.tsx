import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Apex Tech Journal — Systems Engineering, AI Automation & Search Architecture",
  description:
    "Independent engineering publication and autonomous SEO control plane powered by PostgreSQL 16, local Ollama LLMs, and Google Search & AdSense compliance gates."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen font-sans bg-slate-50 dark:bg-[#050811] text-slate-900 dark:text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
