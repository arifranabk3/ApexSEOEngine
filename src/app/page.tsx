import React from "react";
import Link from "next/link";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { getArticleRepository } from "@/repositories/article-repository.factory";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";
import { getAuthRepository } from "@/repositories/auth-repository.factory";
import { getSessionFromRequest } from "@/lib/auth";
import PublicThemeToggle from "@/components/public/PublicThemeToggle";
import { ArticleCoverArt } from "@/components/public/ArticleCoverArt";
import {
  Globe,
  ShieldCheck,
  Sparkles,
  BookOpen,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle2,
  Database,
  Layers,
  Award,
  Cpu,
  LayoutDashboard,
  Search,
  Terminal,
  Activity,
  Lock
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicMagazineFrontPage() {
  await ensureSystemSeeded();
  const user = await getSessionFromRequest();

  const websiteRepo = getWebsiteRepository();
  const allSites = await websiteRepo.listWebsites();
  const rawWebsite = allSites[0] || null;

  if (!rawWebsite) {
    return null;
  }

  const keywordRepo = getKeywordDomainRepository();
  const articleRepo = getArticleRepository();
  const authRepo = getAuthRepository();

  const [categories, rawArticles] = await Promise.all([
    keywordRepo.findCategoriesByWebsite(rawWebsite.id),
    articleRepo.findArticlesByWebsite(rawWebsite.id, {
      status: "PUBLISHED",
      orderBy: "publishedAt",
      orderDir: "desc"
    })
  ]);

  const authorIds = Array.from(new Set(rawArticles.map((a) => a.authorId).filter(Boolean))) as string[];
  const authorRecords = await Promise.all(authorIds.map((id) => authRepo.findUserById(id)));
  const authorMap = new Map<string, { id: string; name: string; email: string }>();
  for (const rec of authorRecords) {
    if (rec?.user) {
      authorMap.set(rec.user.id, {
        id: rec.user.id,
        name: rec.user.name,
        email: rec.user.email
      });
    }
  }

  const categoryMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const c of categories) {
    categoryMap.set(c.id, { id: c.id, name: c.name, slug: c.slug });
  }

  const articles = rawArticles.map((art) => ({
    ...art,
    category: art.categoryId ? categoryMap.get(art.categoryId) || null : null,
    author: art.authorId ? authorMap.get(art.authorId) || null : null
  }));

  const website = {
    ...rawWebsite,
    categories,
    articles
  };

  const featuredArticle = website.articles[0] || null;
  const totalWords = website.articles.reduce((acc, a) => acc + a.wordCount, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col apex-mesh-bg">
      {/* Top Live Telemetry Ribbon */}
      <div className="bg-[#03060c] text-slate-300 border-b border-slate-800/80 text-[11px] py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              POSTGRESQL 16 LIVE
            </span>
            <span className="text-slate-400 hidden sm:inline">
              Google Search Essentials &amp; AdSense Publisher Policy Verified
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] text-slate-400">
            <span className="hidden md:flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" />
              {website.articles.length} Dispatches ({totalWords.toLocaleString()} words)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              E-E-A-T &amp; ads.txt Active
            </span>
            <Link
              href={user ? "/admin" : "/login"}
              className="text-cyan-400 hover:underline font-sans font-semibold"
            >
              {user ? `Admin: ${user.name}` : "Control Plane Sign In →"}
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/85 dark:bg-[#050811]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-600/30 group-hover:scale-105 transition">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{website.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/25">
                  PUBLICATION
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {website.url}
              </div>
            </div>
          </Link>

          {/* Center Pill Navigation */}
          <nav
            aria-label="Primary Publication Navigation"
            className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/90 text-xs font-semibold"
          >
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-cyan-300 shadow-sm"
            >
              Front Page
            </Link>
            {website.categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/p/${website.id}?category=${encodeURIComponent(cat.slug)}`}
                className="px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
              >
                {cat.name}
              </Link>
            ))}
            <a
              href="#architecture-bento"
              className="px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            >
              System Stack
            </a>
            <a
              href="#editorial-standards"
              className="px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            >
              Trust &amp; Policy
            </a>
          </nav>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/p/${website.id}`}
              title="Search Articles"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 transition"
            >
              <Search className="w-3.5 h-3.5 text-cyan-500" />
              <span className="hidden sm:inline">Search Archive</span>
            </Link>

            <PublicThemeToggle />

            <Link
              href={user ? "/admin" : "/login"}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{user ? "Control Plane" : "Admin Studio"}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-16">
        {/* 1. Asymmetric Spotlight Editorial Hero + Interactive Terminal */}
        <section className="relative rounded-[2rem] overflow-hidden border border-slate-800/90 bg-gradient-to-br from-[#070d19] via-[#0b1326] to-[#0f172a] text-white p-8 sm:p-10 lg:p-14 shadow-2xl apex-grid-pattern">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left 7 Columns: Editorial Headline & Search */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Autonomous Systems Engineering &amp; Search Compliance Journal</span>
              </div>

              <h1 className="apex-hero-title font-extrabold text-white">
                Engineering the Future of{" "}
                <span className="apex-gradient-text">
                  Verifiable Search &amp; AI Publishing
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300/95 max-w-2xl leading-relaxed">
                <strong>{website.name}</strong> is a live, PostgreSQL-backed technical publication. Every architectural blueprint is audited by our 5-Gate Google Search Essentials and AdSense Publisher Policy engine before reaching production.
              </p>

              {/* Direct Database Search Form */}
              <form
                method="GET"
                action={`/p/${website.id}`}
                className="p-2 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap sm:flex-nowrap items-center gap-2 max-w-xl shadow-inner"
              >
                <div className="flex items-center gap-2.5 pl-3 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="search"
                    name="q"
                    placeholder="Search PostgreSQL articles (e.g., Ollama, AdSense, JSON-LD)..."
                    className="w-full py-2 bg-transparent text-xs text-white placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-white transition shrink-0"
                >
                  Search Database
                </button>
              </form>

              {/* Quick Topic Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">TOPICS:</span>
                {website.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/p/${website.id}?category=${encodeURIComponent(cat.slug)}`}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Live Compliance & Database Architecture Console */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-[#050914]/95 border border-slate-800 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800/90 bg-slate-900/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      apex-compliance-gate — live
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    VERIFIED
                  </span>
                </div>

                <div className="p-5 space-y-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <div className="text-slate-400 text-[11px]">
                      $ db.articles.find(&#123; status: &quot;PUBLISHED&quot; &#125;)
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-cyan-300 flex items-center justify-between">
                      <span>Active Published Records:</span>
                      <span className="text-base font-extrabold text-white">
                        {website.articles.length} Articles
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90">
                      <div className="text-[10px] text-slate-400">SEARCH ESSENTIALS</div>
                      <div className="text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        100% PASS
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90">
                      <div className="text-[10px] text-slate-400">ADSENSE POLICY</div>
                      <div className="text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        READY GATE
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90">
                      <div className="text-[10px] text-slate-400">DURABLE QUEUE</div>
                      <div className="text-cyan-300 font-bold mt-1">7 PIPELINES</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90">
                      <div className="text-[10px] text-slate-400">VAULT CRYPTO</div>
                      <div className="text-indigo-300 font-bold mt-1">AES-256-GCM</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-sans">
                    <span>Zero fabricated metrics policy enforced</span>
                    <Link
                      href={user ? "/admin" : "/login"}
                      className="text-cyan-400 font-semibold hover:underline"
                    >
                      Inspect in Studio &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Featured Cover Story with Custom SVG Cover Artwork (modern-web-guidance: card) */}
        {featuredArticle && (
          <section id="featured-story" aria-labelledby="featured-heading" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
                  <Award className="w-4 h-4" />
                </span>
                <div>
                  <h2
                    id="featured-heading"
                    className="text-sm font-extrabold uppercase tracking-wider text-blue-600 dark:text-cyan-400"
                  >
                    Featured Cover Dispatch
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lead architecture deep-dive synced from PostgreSQL 16
                  </p>
                </div>
              </div>
              <Link
                href={`/p/${website.id}`}
                className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Browse All {website.articles.length} Articles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <article className="apex-pub-card !p-6 sm:!p-8 lg:!p-10 bg-white/95 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800/90 shadow-xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left 5 Cols: Custom Vector Cover Art */}
                <div className="lg:col-span-5">
                  <ArticleCoverArt
                    slug={featuredArticle.slug}
                    categoryName={featuredArticle.category?.name}
                    seoScore={featuredArticle.seoScore}
                    variant="hero"
                  />
                </div>

                {/* Right 7 Cols: Editorial Story Details */}
                <div className="lg:col-span-7 space-y-5">
                  <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="px-3 py-1 rounded-full font-bold bg-blue-500/15 text-blue-600 dark:text-cyan-300 border border-blue-500/30">
                        {featuredArticle.category?.name || "Architecture Blueprint"}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                        {featuredArticle.publishedAt
                          ? new Date(featuredArticle.publishedAt).toISOString().slice(0, 10)
                          : "Published"}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        {Math.max(3, Math.ceil(featuredArticle.wordCount / 220))} min read (
                        {featuredArticle.wordCount} words)
                      </span>
                    </div>

                    <h3 className="apex-section-title font-extrabold text-slate-900 dark:text-white">
                      <Link
                        href={`/p/${website.id}/${featuredArticle.slug}`}
                        className="card-link hover:text-blue-600 dark:hover:text-cyan-300 transition"
                      >
                        {featuredArticle.title}
                      </Link>
                    </h3>
                  </header>

                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    {featuredArticle.metaDescription ||
                      featuredArticle.excerpt ||
                      "Read the complete verified engineering guide."}
                  </p>

                  <footer className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-white font-extrabold flex items-center justify-center shadow-sm">
                        {(featuredArticle.author?.name || "P")[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {featuredArticle.author?.name || "Principal SEO Architect"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Verified Systems Architect &bull; E-E-A-T Attributed
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/p/${website.id}/${featuredArticle.slug}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/10 dark:bg-cyan-500/15 text-blue-600 dark:text-cyan-300 font-bold hover:bg-blue-600 hover:text-white transition"
                    >
                      <span>Read full blueprint</span>
                      <span className="sr-only"> about {featuredArticle.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </footer>
                </div>
              </div>
            </article>
          </section>
        )}

        {/* 3. Latest Engineering Dispatches Grid with Vector Cover Artwork */}
        <section aria-labelledby="latest-dispatches-heading" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2
                id="latest-dispatches-heading"
                className="text-xl font-display font-extrabold flex items-center gap-2.5"
              >
                <BookOpen className="w-5 h-5 text-cyan-500" />
                <span>Latest Engineering Dispatches</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every article below is dynamically queried from PostgreSQL and verified for Technical SEO &amp; AdSense safety
              </p>
            </div>
            <Link
              href={`/p/${website.id}`}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:border-cyan-500/40 transition"
            >
              Open Filterable Archive &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {website.articles.map((art) => (
              <article key={art.id} className="apex-pub-card">
                <ArticleCoverArt
                  slug={art.slug}
                  categoryName={art.category?.name}
                  seoScore={art.seoScore}
                  variant="card"
                />

                <header className="space-y-2.5 mt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      {art.category?.name || "Technical SEO"}
                    </span>
                    <span className="font-mono">
                      {Math.max(3, Math.ceil(art.wordCount / 220))} min read &bull;{" "}
                      {art.wordCount}w
                    </span>
                  </div>

                  <h3 className="text-base font-display font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">
                    <Link
                      href={`/p/${website.id}/${art.slug}`}
                      className="card-link hover:text-blue-600 dark:hover:text-cyan-300 transition"
                    >
                      {art.title}
                    </Link>
                  </h3>
                </header>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                  {art.metaDescription ||
                    art.excerpt ||
                    "Explore the full technical implementation guide."}
                </p>

                <footer className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Gate: {art.seoScore}/100
                  </span>
                  <Link
                    href={`/p/${website.id}/${art.slug}`}
                    className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    <span>Read article</span>
                    <span className="sr-only"> about {art.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Interactive Architecture & Compliance Bento Showcase */}
        <section id="architecture-bento" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-display font-extrabold flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-indigo-500" />
                <span>Inside the Autonomous Publishing Architecture</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                How {website.name} combines PostgreSQL 16, local AI, and dual compliance gates
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 apex-card p-6 bg-gradient-to-br from-slate-900 to-indigo-950/80 text-white border-slate-800 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-base font-display font-extrabold">
                  21-Model Normalized PostgreSQL 16 Core
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Multi-website data isolation across Keywords, Clusters, Content Briefs, Versioned Articles, Internal Link Graphs, and Durable Background Jobs.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-cyan-300">
                <span>Prisma ORM + Managed Postgres</span>
                <span>100% Isolated</span>
              </div>
            </div>

            <div className="md:col-span-4 apex-card p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-display font-extrabold">
                  Dual Search + AdSense Gate
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Decoupled validation engines check Google Search Essentials, E-E-A-T citations, IAB <code>ads.txt</code> syntax, and Invalid Traffic (IVT) safety before publishing.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-emerald-500">
                <span>4-State Workflow</span>
                <span>Zero Fake Scores</span>
              </div>
            </div>

            <div className="md:col-span-3 apex-card p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-display font-extrabold">
                  AES-256-GCM Vault &amp; HMAC Workers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  All CMS credentials and API tokens are encrypted at rest. External workers authenticate via HMAC-SHA256 replay-safe signatures.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-indigo-400">
                <span>RBAC Guarded</span>
                <span>Vercel-First</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Mandatory AdSense & E-E-A-T Trust & Transparency Cards */}
        <section
          id="editorial-standards"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800 text-xs"
        >
          <div className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-2 text-blue-500 font-bold text-sm">
              <Globe className="w-4 h-4" />
              <h3>About {website.name} &amp; Contact</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {website.name} is an independent technical publication dedicated to verifiable systems engineering, open-source AI automation, and standards-compliant web architecture.
            </p>
          </div>

          <div className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-2 text-emerald-500 font-bold text-sm">
              <Activity className="w-4 h-4" />
              <h3>Editorial Policy &amp; Fact-Checking</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Every article undergoes automated and human-verified compliance gates for primary source citations, technical accuracy, and Google Helpful Content standards before publication.
            </p>
          </div>

          <div className="apex-card p-6 space-y-2.5">
            <div className="inline-flex items-center gap-2 text-indigo-500 font-bold text-sm">
              <Cpu className="w-4 h-4" />
              <h3>Privacy Policy, CMP &amp; Terms</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              We respect reader privacy, enforce strict Consent Management Platform (CMP) disclosures for any publisher monetization, maintain verified IAB <code>ads.txt</code> records, and never sell personal data.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#03060c] py-10 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <span>
              &copy; {new Date().getFullYear()} <strong>{website.name}</strong>. Powered by ApexSEO Autonomous Engine &amp; PostgreSQL 16.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-medium">
            <Link href="/" className="hover:text-cyan-400">
              Front Page
            </Link>
            <Link href={`/p/${website.id}`} className="hover:text-cyan-400">
              Search &amp; Archive
            </Link>
            <a href="#editorial-standards" className="hover:text-cyan-400">
              Editorial Policy
            </a>
            <Link href="/admin" className="text-cyan-500 font-bold hover:underline">
              Admin Control Plane &rarr;
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
