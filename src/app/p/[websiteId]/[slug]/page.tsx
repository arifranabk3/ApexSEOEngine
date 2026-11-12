import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { ArrowLeft, ShieldCheck, Calendar, UserCheck, Globe } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href={`/p/${websiteId}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-blue-500 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {article.website.name}</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Search &amp; AdSense Verified</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
        <article className="p-8 lg:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-blue-500">
                <Globe className="w-3.5 h-3.5" />
                {article.category?.name || "Technical Guide"}
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                By {article.author?.name || "Principal SEO Architect"}
              </span>
              <span>&bull;</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {article.publishedAt
                  ? new Date(article.publishedAt).toISOString().slice(0, 10)
                  : "Published"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              {article.title}
            </h1>

            {article.metaDescription && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {article.metaDescription}
              </p>
            )}
          </div>

          <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed space-y-4 whitespace-pre-wrap">
            {article.content}
          </div>
        </article>
      </main>
    </div>
  );
}

