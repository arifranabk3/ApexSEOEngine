import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { Globe, BookOpen, ShieldCheck, ArrowRight, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPublicationHomePage({
  params
}: {
  params: Promise<{ websiteId: string }>;
}) {
  await ensureSystemSeeded();
  const { websiteId } = await params;
  const db = await getDb();

  const website = await db.website.findUnique({
    where: { id: websiteId },
    include: {
      categories: true,
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" }
      }
    }
  });

  if (!website) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Public Publication Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight">
                {website.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {website.url}
              </div>
            </div>
          </div>

          <nav aria-label="Public Site Navigation" className="flex items-center gap-5 text-xs font-semibold">
            <a href="#articles" className="hover:text-blue-500">
              Articles
            </a>
            <a href="#about" className="hover:text-blue-500">
              About Us
            </a>
            <a href="#editorial-policy" className="hover:text-blue-500">
              Editorial Policy
            </a>
            <a href="#privacy" className="hover:text-blue-500">
              Privacy &amp; Terms
            </a>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700"
            >
              Control Plane &rarr;
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-12">
        <section className="p-8 rounded-3xl bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>Vercel-First Resilient Public Publication &bull; Zero Worker Dependency</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {website.name} — Verified Technical Publication
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
            This public website is served directly by Next.js on Vercel from the managed PostgreSQL database. It remains 100% online and fast even when the external background automation worker or n8n service is offline.
          </p>
        </section>

        {/* Published Articles Feed */}
        <section id="articles" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span>Published Articles ({website.articles.length})</span>
            </h2>
            <span className="text-xs text-slate-500">
              Verified by Google Search &amp; AdSense Publishing Gate
            </span>
          </div>

          {website.articles.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
              <div className="text-sm font-bold">No Articles Published Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Articles appear here automatically once they pass the 5-Gate Search + AdSense Compliance check and are processed by the durable publishing job queue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {website.articles.map((art) => (
                <article
                  key={art.id}
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        {art.publishedAt
                          ? new Date(art.publishedAt).toISOString().slice(0, 10)
                          : "Published"}
                      </span>
                      <span>&bull;</span>
                      <span>{art.wordCount} words</span>
                    </div>
                    <h3 className="text-base font-extrabold tracking-tight">
                      <Link
                        href={`/p/${website.id}/${art.slug}`}
                        className="hover:text-blue-500 transition"
                      >
                        {art.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3">
                      {art.metaDescription || art.excerpt || "Read the full technical article."}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-emerald-500 font-semibold">
                      SEO Gate: {art.seoScore}/100
                    </span>
                    <Link
                      href={`/p/${website.id}/${art.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:underline"
                    >
                      <span>Read Article</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Mandatory AdSense Publisher Identity & Trust Sections */}
        <section
          id="about"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs"
        >
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="font-bold text-sm">About Us &amp; Contact</h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              {website.name} is an independent technical publication dedicated to verifiable systems engineering, open-source AI automation, and standards-compliant web architecture.
            </p>
          </div>
          <div
            id="editorial-policy"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
          >
            <h3 className="font-bold text-sm">Editorial Policy &amp; Fact-Checking</h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Every article undergoes automated and human-verified compliance checks for primary source citations, technical accuracy, and Google Helpful Content standards before publication.
            </p>
          </div>
          <div
            id="privacy"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
          >
            <h3 className="font-bold text-sm">Privacy Policy &amp; Terms</h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              We respect reader privacy, enforce strict Consent Management Platform (CMP) disclosures for any publisher monetization, and never sell personal data.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

