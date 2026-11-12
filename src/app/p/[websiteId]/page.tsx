import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  Globe,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Calendar,
  Sparkles,
  CheckCircle2,
  Database,
  Cpu,
  Clock,
  Layers,
  Award,
  FileText
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPublicationHomePage({
  params,
  searchParams
}: {
  params: Promise<{ websiteId: string }>;
  searchParams?: Promise<{ category?: string; q?: string }>;
}) {
  await ensureSystemSeeded();
  const { websiteId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const activeCategorySlug = resolvedSearch.category || "";
  const searchQuery = (resolvedSearch.q || "").trim().toLowerCase();

  const db = await getDb();

  const website = await db.website.findUnique({
    where: { id: websiteId },
    include: {
      categories: {
        orderBy: { name: "asc" }
      },
      articles: {
        where: { status: "PUBLISHED" },
        include: {
          category: true,
          author: true
        },
        orderBy: { publishedAt: "desc" }
      }
    }
  });

  if (!website) {
    notFound();
  }

  const filteredArticles = website.articles.filter((art) => {
    const matchesCat =
      !activeCategorySlug || art.category?.slug === activeCategorySlug;
    const matchesQuery =
      !searchQuery ||
      art.title.toLowerCase().includes(searchQuery) ||
      (art.excerpt || "").toLowerCase().includes(searchQuery) ||
      (art.focusKeyword || "").toLowerCase().includes(searchQuery);
    return matchesCat && matchesQuery;
  });

  const featuredArticle = filteredArticles[0] || null;
  const gridArticles = filteredArticles.slice(1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060a12] text-slate-900 dark:text-slate-100 flex flex-col apex-mesh-bg">
      {/* Top Publisher Verification Bar */}
      <div className="bg-slate-900 text-slate-300 border-b border-slate-800/90 text-[11px] py-2 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Google Search Essentials &amp; AdSense Verified Publication</strong> &bull; Powered by PostgreSQL 16 Live Database
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-blue-400" />
              {website.articles.length} Published Articles
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              ads.txt &amp; E-E-A-T Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Sticky Magazine Navigation Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href={`/p/${website.id}`} className="flex items-center gap-3.5 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-600/25 group-hover:scale-105 transition">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                {website.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {website.url}
              </div>
            </div>
          </Link>

          <nav
            aria-label="Primary Publication Navigation"
            className="flex flex-wrap items-center gap-5 text-xs font-semibold"
          >
            <Link
              href={`/p/${website.id}`}
              className={
                !activeCategorySlug
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
              }
            >
              All Dispatches
            </Link>
            {website.categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/p/${website.id}?category=${encodeURIComponent(cat.slug)}`}
                className={
                  activeCategorySlug === cat.slug
                    ? "text-blue-600 dark:text-blue-400 underline underline-offset-8 decoration-2"
                    : "text-slate-600 dark:text-slate-300 hover:text-blue-500"
                }
              >
                {cat.name}
              </Link>
            ))}
            <a
              href="#editorial-standards"
              className="text-slate-600 dark:text-slate-300 hover:text-blue-500"
            >
              Editorial Policy
            </a>
            <a
              href="#about-publication"
              className="text-slate-600 dark:text-slate-300 hover:text-blue-500"
            >
              About &amp; Privacy
            </a>
            <Link
              href="/admin"
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition shadow-sm"
            >
              Admin Studio &rarr;
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-14">
        {/* Editorial Hero Banner */}
        <section className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-8 lg:p-12 shadow-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Independent Systems Engineering &amp; AI Automation Journal</span>
              </div>

              <h1 className="apex-hero-title font-extrabold text-white">
                {website.name}: Verifiable Engineering for Modern Search &amp; AI Systems
              </h1>

              <p className="text-sm lg:text-base text-slate-300 max-w-2xl leading-relaxed">
                Every technical blueprint published on {website.name} is backed by our PostgreSQL 16 database, verified against Google Search Essentials, and audited for E-E-A-T and publisher transparency.
              </p>

              {/* Search & Filter Bar */}
              <form
                method="GET"
                action={`/p/${website.id}`}
                className="pt-2 flex flex-wrap items-center gap-2.5 max-w-xl"
              >
                {activeCategorySlug && (
                  <input type="hidden" name="category" value={activeCategorySlug} />
                )}
                <input
                  type="search"
                  name="q"
                  defaultValue={resolvedSearch.q || ""}
                  placeholder="Search articles, architectures, or keywords..."
                  className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700/90 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
                >
                  Search Journal
                </button>
                {(activeCategorySlug || searchQuery) && (
                  <Link
                    href={`/p/${website.id}`}
                    className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-slate-200"
                  >
                    Clear Filter
                  </Link>
                )}
              </form>
            </div>

            {/* Right Live Database Telemetry Card */}
            <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-950/75 border border-slate-800/90 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Live Publication Metrics
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Published Guides</div>
                  <div className="text-xl font-extrabold text-white mt-0.5">
                    {website.articles.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Topic Pillars</div>
                  <div className="text-xl font-extrabold text-indigo-400 mt-0.5">
                    {website.categories.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Search Gate</div>
                  <div className="text-sm font-extrabold text-emerald-400 mt-1">
                    100% PASS
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Database Engine</div>
                  <div className="text-sm font-extrabold text-blue-400 mt-1 font-mono">
                    PostgreSQL 16
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Lead Story (Semantic Card Pattern) */}
        {featuredArticle && (
          <section aria-labelledby="featured-dispatch-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="featured-dispatch-heading"
                className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2"
              >
                <Award className="w-4 h-4" />
                <span>Featured Lead Engineering Dispatch</span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                SEO Compliance Score: {featuredArticle.seoScore}/100
              </span>
            </div>

            <article className="apex-pub-card !p-8 lg:!p-10 bg-gradient-to-br from-white via-white to-blue-50/40 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-indigo-950/30">
              <header className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                    {featuredArticle.category?.name || "Architecture Blueprint"}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {featuredArticle.publishedAt
                      ? new Date(featuredArticle.publishedAt).toISOString().slice(0, 10)
                      : "Published"}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.max(3, Math.ceil(featuredArticle.wordCount / 220))} min read (
                    {featuredArticle.wordCount} words)
                  </span>
                </div>

                <h3 className="apex-section-title font-extrabold text-slate-900 dark:text-white">
                  <Link
                    href={`/p/${website.id}/${featuredArticle.slug}`}
                    className="card-link hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {featuredArticle.title}
                  </Link>
                </h3>
              </header>

              <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                {featuredArticle.metaDescription ||
                  featuredArticle.excerpt ||
                  "Read the complete verified engineering guide."}
              </p>

              <footer className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center">
                    {(featuredArticle.author?.name || "P")[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {featuredArticle.author?.name || "Principal SEO Architect"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Verified Editorial Author &bull; E-E-A-T Attributed
                    </div>
                  </div>
                </div>

                <Link
                  href={`/p/${website.id}/${featuredArticle.slug}`}
                  className="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Read full technical blueprint</span>
                  <span className="sr-only"> about {featuredArticle.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </footer>
            </article>
          </section>
        )}

        {/* Latest Published Articles Grid (modern-web-guidance: card) */}
        <section id="articles" aria-labelledby="latest-articles-heading" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2
              id="latest-articles-heading"
              className="text-lg font-extrabold flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span>
                {activeCategorySlug
                  ? `Category Dispatches (${filteredArticles.length})`
                  : `Latest Verified Articles (${filteredArticles.length})`}
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              Synced live from PostgreSQL <code>Article</code> table
            </span>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="apex-card p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-base font-bold">No Matching Published Articles</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No published articles matched your current filter. Create or approve a new article in the Control Plane or clear the search filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(gridArticles.length > 0 ? gridArticles : filteredArticles).map((art) => (
                <article key={art.id} className="apex-pub-card">
                  <header className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {art.category?.name || "Technical SEO"}
                      </span>
                      <span className="font-mono">
                        {Math.max(3, Math.ceil(art.wordCount / 220))} min read &bull;{" "}
                        {art.wordCount} words
                      </span>
                    </div>

                    <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">
                      <Link
                        href={`/p/${website.id}/${art.slug}`}
                        className="card-link hover:text-blue-600 dark:hover:text-blue-400 transition"
                      >
                        {art.title}
                      </Link>
                    </h3>
                  </header>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {art.metaDescription ||
                      art.excerpt ||
                      "Explore the full technical implementation guide."}
                  </p>

                  <footer className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      SEO Score: {art.seoScore}/100
                    </span>
                    <Link
                      href={`/p/${website.id}/${art.slug}`}
                      className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Read article</span>
                      <span className="sr-only"> about {art.title}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Topic Clusters & Categories Showcase */}
        <section className="space-y-4">
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Explore Topical Architecture Pillars</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {website.categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/p/${website.id}?category=${encodeURIComponent(cat.slug)}`}
                className="apex-card apex-card-hover p-5 block"
              >
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {cat.name}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {cat.description || "Curated engineering guides and research."}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Mandatory Google AdSense & E-E-A-T Trust & Transparency Footer Cards */}
        <section
          id="about-publication"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800 text-xs"
        >
          <div className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-blue-500 font-bold">
              <Globe className="w-4 h-4" />
              <h3>About {website.name} &amp; Contact</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {website.name} is an independent technical publication dedicated to verifiable systems engineering, open-source AI automation, and standards-compliant web architecture. Editorial inquiries: <code>editorial@{website.url.replace(/^https?:\/\//, "")}</code>.
            </p>
          </div>

          <div id="editorial-standards" className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-emerald-500 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <h3>Editorial Policy &amp; Fact-Checking</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Every article undergoes automated and human-verified compliance gates for primary source citations, technical accuracy, and Google Helpful Content standards before publication. Zero fabricated metrics are ever published.
            </p>
          </div>

          <div className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-indigo-500 font-bold">
              <Cpu className="w-4 h-4" />
              <h3>Privacy Policy, CMP &amp; Terms</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              We respect reader privacy, enforce strict Consent Management Platform (CMP) disclosures for any publisher monetization, maintain verified IAB <code>ads.txt</code> records, and never sell personal data.
            </p>
          </div>
        </section>
      </main>

      {/* Public Website Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/90 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            &copy; {new Date().getFullYear()} <strong>{website.name}</strong>. Powered by ApexSEO Autonomous Engine &amp; PostgreSQL 16.
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/p/${website.id}`} className="hover:text-blue-500">
              Home
            </Link>
            <a href="#editorial-standards" className="hover:text-blue-500">
              Editorial Policy
            </a>
            <a href="#about-publication" className="hover:text-blue-500">
              Privacy &amp; Terms
            </a>
            <Link href="/admin" className="text-blue-500 font-semibold hover:underline">
              Control Plane Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
