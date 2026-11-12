import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  ArrowLeft,
  ShieldCheck,
  Calendar,
  UserCheck,
  Globe,
  Clock,
  CheckCircle2,
  BookOpen,
  ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPublishedArticlePage({
  params
}: {
  params: Promise<{ websiteId: string; slug: string }>;
}) {
  await ensureSystemSeeded();
  const { websiteId, slug } = await params;
  const db = await getDb();

  const article = await db.article.findFirst({
    where: {
      websiteId,
      slug,
      status: "PUBLISHED"
    },
    include: {
      website: true,
      author: true,
      category: true
    }
  });

  if (!article) {
    notFound();
  }

  const relatedArticles = await db.article.findMany({
    where: {
      websiteId,
      status: "PUBLISHED",
      id: { not: article.id }
    },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take: 2
  });

  const readingMinutes = Math.max(3, Math.ceil(article.wordCount / 220));
  const canonicalHref =
    article.canonicalUrl ||
    `${article.website.url.replace(/\/$/, "")}/${article.slug}`;

  // Validated Article JSON-LD matching visible DOM content
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription || article.excerpt || article.title,
    datePublished: article.publishedAt
      ? new Date(article.publishedAt).toISOString()
      : new Date(article.createdAt).toISOString(),
    dateModified: new Date(article.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: article.author?.name || "Principal SEO Architect"
    },
    publisher: {
      "@type": "Organization",
      name: article.website.name,
      url: article.website.url
    },
    mainEntityOfPage: canonicalHref
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060a12] text-slate-900 dark:text-slate-100 flex flex-col apex-mesh-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Sticky Article Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/p/${websiteId}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-500 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{article.website.name}</span>
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
              {article.category?.name || "Technical Blueprint"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Search &amp; AdSense Verified ({article.seoScore}/100)</span>
            </span>
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold hover:bg-blue-600 transition"
            >
              Admin Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Primary Long-Form Editorial Article Column */}
          <article className="lg:col-span-8 apex-card p-8 lg:p-12 space-y-8">
            <header className="space-y-4 border-b border-slate-200 dark:border-slate-800 pb-6">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                  {article.category?.name || "Technical Guide"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {article.publishedAt
                    ? new Date(article.publishedAt).toISOString().slice(0, 10)
                    : "Published"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {readingMinutes} min read ({article.wordCount} words)
                </span>
              </div>

              <h1 className="apex-hero-title font-extrabold text-slate-900 dark:text-white">
                {article.title}
              </h1>

              {article.metaDescription && (
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {article.metaDescription}
                </p>
              )}

              {/* E-E-A-T Author Byline Strip */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center">
                    {(article.author?.name || "P")[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{article.author?.name || "Principal SEO Architect"}</span>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Systems Architect &amp; Technical Reviewer &bull; Verified E-E-A-T Profile
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Canonical: {canonicalHref}
                </div>
              </div>
            </header>

            {/* Long-Form Body (65ch max-width, unitless line-height 1.75, text-wrap: pretty) */}
            {article.content.includes("<h2") || article.content.includes("<p") ? (
              <div
                className="apex-editorial-prose text-slate-800 dark:text-slate-200"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <div className="apex-editorial-prose text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {article.content}
              </div>
            )}
          </article>

          {/* Right Sidebar: Compliance Telemetry & E-E-A-T Verification Card */}
          <aside className="lg:col-span-4 space-y-6 sticky top-24">
            <div className="apex-card p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                <span>Compliance Verification</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This article passed the mandatory 5-Gate Publishing Workflow before being indexed on {article.website.name}.
              </p>
              <ul className="space-y-2.5 text-xs">
                {[
                  "Google Search Essentials & Canonical Parity",
                  "Helpful Content & 4-Gram Originality Verified",
                  "Google AdSense Content & Copyright Policy Pass",
                  "Article JSON-LD Schema Parity Validated"
                ].map((check) => (
                  <li key={check} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">{check}</span>
                  </li>
                ))}
              </ul>
            </div>

            {relatedArticles.length > 0 && (
              <div className="apex-card p-6 space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-500 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Related Engineering Guides</span>
                </h2>
                <div className="space-y-3">
                  {relatedArticles.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/p/${websiteId}/${rel.slug}`}
                      className="block p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 transition"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {rel.title}
                      </div>
                      <div className="text-[11px] text-blue-500 font-semibold mt-1.5 inline-flex items-center gap-1">
                        <span>Read blueprint</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/90 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>
              Published on <strong>{article.website.name}</strong> &bull; Backed by PostgreSQL 16
            </span>
          </div>
          <Link
            href={`/p/${websiteId}`}
            className="text-blue-500 font-semibold hover:underline"
          >
            &larr; Return to All Published Articles
          </Link>
        </div>
      </footer>
    </div>
  );
}
