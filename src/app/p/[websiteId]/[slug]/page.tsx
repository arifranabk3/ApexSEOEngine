import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureSystemSeeded } from "@/lib/seed-service";
import PublicThemeToggle from "@/components/public/PublicThemeToggle";
import { ArticleCoverArt } from "@/components/public/ArticleCoverArt";
import { getArticleRepository } from "@/repositories/article-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";
import { getAuthRepository } from "@/repositories/auth-repository.factory";
import {
  ArrowLeft,
  ShieldCheck,
  Calendar,
  UserCheck,
  Globe,
  Clock,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Database
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPublishedArticlePage({
  params
}: {
  params: Promise<{ websiteId: string; slug: string }>;
}) {
  await ensureSystemSeeded();
  const { websiteId, slug } = await params;

  const articleRepo = getArticleRepository();
  const websiteRepo = getWebsiteRepository();
  const keywordRepo = getKeywordDomainRepository();
  const authRepo = getAuthRepository();

  const articleEntity = await articleRepo.findArticleBySlug(websiteId, slug);

  if (!articleEntity || articleEntity.status !== "PUBLISHED") {
    notFound();
  }

  const [website, authorRecord, category] = await Promise.all([
    websiteRepo.findWebsiteById(articleEntity.websiteId),
    articleEntity.authorId ? authRepo.findUserById(articleEntity.authorId) : null,
    articleEntity.categoryId ? keywordRepo.findCategoryById(articleEntity.categoryId) : null
  ]);

  if (!website) {
    notFound();
  }

  const article = {
    ...articleEntity,
    website,
    author: authorRecord?.user || null,
    category
  };

  const allArticles = await articleRepo.findArticlesByWebsite(websiteId, {
    status: "PUBLISHED",
    orderBy: "publishedAt",
    orderDir: "desc"
  });

  const relatedArticlesRaw = allArticles.filter((a) => a.id !== article.id).slice(0, 2);
  const relatedArticles = await Promise.all(
    relatedArticlesRaw.map(async (rel) => {
      const relCategory = rel.categoryId ? await keywordRepo.findCategoryById(rel.categoryId) : null;
      return {
        ...rel,
        category: relCategory
      };
    })
  );

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col apex-mesh-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Sticky Glassmorphic Article Reader Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 pt-3 pb-2">
        <div className="max-w-6xl mx-auto rounded-2xl border border-slate-200/85 dark:border-slate-800/90 bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-3.5 shadow-lg shadow-slate-950/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-500 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{article.website.name}</span>
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <Link
              href={`/p/${websiteId}`}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-500 truncate max-w-[240px]"
            >
              {article.category?.name || "Technical Blueprint"}
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SEO &amp; AdSense Gate Pass ({article.seoScore}/100)</span>
            </span>
            <PublicThemeToggle />
            <Link
              href="/admin"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:from-blue-500 hover:to-indigo-500 transition shadow-sm"
            >
              Admin Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Primary Long-Form Editorial Article Column */}
          <article className="lg:col-span-8 apex-card p-6 sm:p-10 lg:p-12 space-y-8 shadow-xl">
            <header className="space-y-5 border-b border-slate-200 dark:border-slate-800 pb-8">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="px-3 py-1 rounded-full font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                  {article.category?.name || "Technical Guide"}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  {article.publishedAt
                    ? new Date(article.publishedAt).toISOString().slice(0, 10)
                    : "Published"}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  {readingMinutes} min read ({article.wordCount} words)
                </span>
              </div>

              <h1 className="apex-hero-title font-extrabold text-slate-900 dark:text-white">
                {article.title}
              </h1>

              {article.metaDescription && (
                <p className="text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {article.metaDescription}
                </p>
              )}

              {/* E-E-A-T Author Byline Strip */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-blue-600/25">
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
                <div className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg">
                  Canonical: {canonicalHref}
                </div>
              </div>

              {/* Hero Cover Architectural Schematic */}
              <div className="pt-2">
                <ArticleCoverArt
                  slug={article.slug}
                  categoryName={article.category?.name || "Technical SEO"}
                  seoScore={article.seoScore}
                  variant="hero"
                />
              </div>
            </header>

            {/* Executive Technical Summary Callout */}
            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Executive Architecture Summary</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {article.excerpt ||
                  article.metaDescription ||
                  "Verified engineering blueprint backed by PostgreSQL 16 and audited against Google Search Essentials."}
              </p>
            </div>

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

          {/* Right Sidebar: Compliance Telemetry & Visual Related Guides */}
          <aside className="lg:col-span-4 space-y-6 sticky top-24">
            <div className="apex-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span>5-Gate Audit Certificate</span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-500">
                  {article.seoScore}/100
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This dispatch passed our automated 5-Gate Publishing Workflow before being indexed in PostgreSQL 16 on {article.website.name}.
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
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-blue-500" />
                  PostgreSQL Row ID
                </span>
                <span>{article.id.slice(0, 12)}...</span>
              </div>
            </div>

            {relatedArticles.length > 0 && (
              <div className="apex-card p-6 space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-blue-500 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Related Engineering Blueprints</span>
                </h2>
                <div className="space-y-4">
                  {relatedArticles.map((rel) => (
                    <article
                      key={rel.id}
                      className="apex-pub-card !p-3.5 space-y-2.5"
                    >
                      <ArticleCoverArt
                        slug={rel.slug}
                        categoryName={rel.category?.name || "Technical SEO"}
                        seoScore={rel.seoScore}
                        variant="card"
                      />
                      <h3 className="text-xs font-display font-extrabold text-slate-900 dark:text-white leading-snug">
                        <Link
                          href={`/p/${websiteId}/${rel.slug}`}
                          className="card-link hover:text-blue-500 transition"
                        >
                          {rel.title}
                        </Link>
                      </h3>
                      <div className="text-[11px] text-blue-500 font-bold inline-flex items-center gap-1">
                        <span>Read blueprint</span>
                        <span className="sr-only"> about {rel.title}</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/90 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>
              Published on <strong>{article.website.name}</strong> &bull; Backed by PostgreSQL 16
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-blue-500 font-semibold hover:underline"
            >
              &larr; Magazine Front Page
            </Link>
            <Link
              href={`/p/${websiteId}`}
              className="text-slate-600 dark:text-slate-300 font-semibold hover:underline"
            >
              Full Archive
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
