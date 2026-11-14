# Phase 02.1-F: Architecture Inspection & Gap Analysis Report
**Milestone:** Phase 02.1-F — Article SEO Quality & Editorial Review Engine  
**Project:** Apex SEO Engine  
**Date:** 2026-11-14  
**Author:** AI Agent & Core Engine Architect  

---

## 1. Executive Summary

In accordance with Phase 02.1-F Gate F1 requirements, we performed an exhaustive inspection of the existing codebase to identify reusable components and genuine architectural gaps for the **Article SEO Quality & Editorial Review Engine**.

The objective is to establish an enterprise-grade evaluation pipeline that complements (rather than duplicates or replaces) our existing **Google Search Compliance Gate** and **AdSense Compliance Engine**.

---

## 2. Codebase Inspection & Reusability Matrix

| Existing Module / Model | Location | Current Capability | Reusability in Phase 02.1-F |
|---|---|---|---|
| **`Article` Model** | `prisma/schema.prisma` | Stores `title`, `slug`, `content`, `seoScore`, `status`, `focusKeyword`, `metaTitle`, `metaDescription`, `wordCount`. | **100% Reused.** No new table required. We can store detailed editorial review evaluations in versions or ContentBrief without schema alterations. |
| **`ArticleVersion` Model** | `prisma/schema.prisma` | Tracks version snapshots with `versionNumber`, `title`, `content`, `changeSummary`, `createdBy`. | **100% Reused.** Records revisions when editorial improvements or fact corrections are applied. |
| **`InternalLink` Model** | `prisma/schema.prisma` | Contains `websiteId`, `sourceArticleId`, `targetArticleId`, `anchorText`, `targetUrl`, `status`, `relevanceScore`. | **100% Reused.** Already exists in the database schema! Can be populated directly by Phase F4 Internal Linking Intelligence. |
| **`ContentBrief` Model** | `prisma/schema.prisma` | Stores `outline` (JSON), `secondaryKeywords` (JSON), `searchIntent`, and target specifications. | **100% Reused.** Supplies baseline keywords and intent for coverage comparison. |
| **`OllamaAdapter`** | `src/services/ai/provider-adapter.ts` | Discovers models, supports structured JSON outputs via `generateStructuredOutput<T>`, with Zod schema validation. | **100% Reused.** Powers AI factual extraction and semantic claim auditing under Zero-Cost Policy. |
| **`ModularArticleGenerator`** | `src/services/ai/modular-article-generator.ts` | Builds section-by-section markdown and tracks `unverifiedClaims` and `citedEntitiesOrSources`. | **100% Reused.** Provides input claims and sources directly into Phase F3. |
| **`evaluateGoogleSearchComplianceGate`** | `src/services/compliance/seo-quality-gate.ts` | Evaluates technical SEO, canonicals, mobile friendliness, PageSpeed limits, spam policies, and schema parity. | **100% Preserved & Reused.** Phase F will invoke this gate as one of three independent evaluation tiers. |
| **`evaluateAdSenseCompliance`** | `src/services/compliance/adsense-compliance-engine.ts` | Evaluates publisher identity (About, Contact, Privacy, Terms), ads.txt, ad placement, and content scraper policy. | **100% Preserved & Reused.** Phase F will display AdSense compliance as an independent tier. |
| **`DurableJobQueue`** | `src/services/automation/durable-job-queue.ts` | PostgreSQL-backed durable queue for long-running worker tasks. | **100% Reused.** Can enqueue `SEO_AUDITING` jobs for background processing when needed. |
| **Dashboard Shell** | `src/components/dashboard/DashboardShell.tsx` | Next.js control plane with tabs for `SEO & AdSense Gate`, `AI Article Writer`, `Internal Linking`. | **100% Reused.** We will enhance the review workflow inside the article review dashboard. |

---

## 3. Gap Analysis: What is Missing & Needs to be Built

While the foundational models and compliance engines exist, the following specialized editorial and intelligence capabilities must be built:

1. **Phase F2: Modular SEO Quality Analysis Engine (`src/services/seo/seo-quality-engine.ts`)**:
   - Missing: A multi-factor editorial scoring engine (0-100) evaluating:
     - Title and meta description search snippet appeal (length, keyword placement, click intent).
     - Heading hierarchy (H1 singularity, H2/H3 logical progression, heading fluff/repetition).
     - Focus & secondary keyword coverage (synonym and intent coverage without keyword stuffing).
     - Topic completeness and FAQ usefulness.
     - Introduction hook & conclusion takeaways.
     - Image alt text coverage and quality.
     - **Strict Rule:** Must explicitly state that editorial score &ne; Google ranking algorithm.

2. **Phase F3: Factual Claim & Source Reviewer (`src/services/seo/factual-claim-reviewer.ts`)**:
   - Missing: Dedicated parser to extract numerical statements, research claims, and technical assertions.
   - Categorizes claims into: `VERIFIED`, `UNVERIFIED` (requires human fact-checking), or `UNVERIFIABLE`.
   - Flags missing citations and validates existing source attribution.
   - **Strict Rule:** Never fabricates citations, studies, or benchmark statistics.

3. **Phase F4: Internal Linking Intelligence (`src/services/seo/internal-linking-engine.ts`)**:
   - Missing: Graph analyzer connecting existing articles within the **same website/tenant**:
     - Scans published and draft articles for semantic keyword matches.
     - Generates natural anchor text recommendations and insertion contexts.
     - Persists recommendations to the existing `InternalLink` table.
     - Detects potential orphan articles and prevents duplicate link spam.

4. **Phase F5 & F6: Consolidated Editorial Review Endpoint & Quality Gates (`/api/v1/content/editorial-review`)**:
   - Missing: Dedicated API endpoint that aggregates the three distinct evaluation tiers:
     - Tier 1: **Editorial Quality Score** (content depth, readability, headings, keywords).
     - Tier 2: **Factual Claim & Source Review** (verified vs unverified claims).
     - Tier 3: **Compliance Gates** (Google Search Compliance Gate + AdSense Policy Gate).
   - Manages editorial review states: `NOT_REVIEWED` &rarr; `IN_REVIEW` &rarr; `NEEDS_REVISION` &rarr; `APPROVED` &rarr; `BLOCKED`.
   - **Strict Rule:** Human approval never triggers automatic publishing.

5. **Phase F5: Interactive Editorial Review Dashboard Panel**:
   - Embeds into `DashboardShell.tsx` (under article details / review modal) displaying the 3 tiers, claim inspector, and internal link suggestions.

---

## 4. Database Schema Impact Assessment
- **New Tables Required:** **0 (Zero)**.
- **Model Extensions:** None required. `Article`, `ArticleVersion`, `InternalLink`, and `ContentBrief` already contain the necessary fields.
- **Data Safety:** No migrations or resets will be executed. Existing production data remains 100% untouched.

---

## 5. Implementation Roadmap (Phases F2 through F8)

```
[Gate F1: Architecture Inspection] (Current Step)
         │
         ▼
[Phase F2: Modular SEO Quality Analysis Engine]
         │
         ▼
[Phase F3: Factual Claim & Source Reviewer]
         │
         ▼
[Phase F4: Internal Linking Intelligence & Graph Generator]
         │
         ▼
[Phase F5: Editorial Review REST API & Workflow State Management]
         │
         ▼
[Phase F6: Dashboard Review Panel Integration]
         │
         ▼
[Phase F7: Quality Gates & Multi-Tenant Security Verification]
         │
         ▼
[Phase F8: Comprehensive Testing & Verification Suite]
```

---

## 6. Stop Condition & Approval Request

Phase F1 is complete. We await your authorization to proceed with **Phase F2: Modular SEO Quality Analysis Engine**.
