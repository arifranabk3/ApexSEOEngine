# Phase 02.1-C — Topic Cluster & Outline Builder Implementation Log

**Date:** 2026-11-14  
**Project:** Apex SEO Engine  
**Milestone:** Phase 02.1-C  
**Status:** COMPLETED & FULLY VERIFIED LOCALLY (Ready for Approval Gate C)

---

## 1. Overview & Architecture Preservation

In accordance with Approval Gate B instructions:
- Built the **AI-Powered Topic Cluster & Article Outline Builder** using the existing `OllamaAdapter` extended in Phase 02.1-B.
- Reused existing database entities (`Website`, `AIProvider`, `AIModel`, `KeywordCluster`, `Keyword`, `ContentBrief`, `Article`, `ArticleVersion`). **Zero new database tables or schema modifications introduced**.
- Extended the existing Content Management architecture with an authenticated API route: `/api/v1/content/topic-outline`.
- Extended the existing admin dashboard (`AI Article Writer` / `Content Planner` tab) by embedding a dedicated guided workflow (`TopicOutlineWorkflow.tsx`).
- Maintained the strict **Zero-Cost Policy**: runs on self-hosted Ollama (`llama3.2`), zero paid APIs or subscriptions.
- Implemented **Zod-backed structured JSON validation** across all stages (Topic Analysis, Topic Cluster, Outline Generation, Outline Quality Validation).
- Enforced strict tenant isolation, RBAC permissions (`content:write`), and audit logging.

---

## 2. Modules Implemented & Extended

1. **`src/services/ai/topic-outline-schemas.ts` (New)**:
   - Defined strict Zod schemas for all workflow steps:
     - `TopicAnalysisInputSchema`: Validates website, main topic, focus keyword, secondary keywords, search intent, audience, country, language, article type, and reference URLs.
     - `TopicAnalysisOutputSchema`: Structured output for main topic, keywords, entities, user pain points, related questions, content gaps, angle, and user outcomes.
     - `TopicClusterOutputSchema`: Structured pillar-spoke architecture, spoke article suggestions, internal linking strategy, and cannibalization prevention.
     - `ArticleOutlineOutputSchema`: Structured outline with SEO title, meta description, URL slug, H1, H2 sections (with objectives, questions answered, table/comparison concepts, diagram concepts, and internal link anchors), practical takeaways, and FAQs.
     - `OutlineValidationReport`: Quality gate verdict (`PASS`, `WARNING`, `BLOCKED`), quality heuristic score (0-100), issue diagnostics, and Google ranking disclaimer.

2. **`src/services/ai/outline-validator.ts` (New)**:
   - Deterministic compliance & quality gate evaluator:
     - Verifies keyword presence in title and H1.
     - Audits title length (45-65 chars recommended) and meta description depth (120-160 chars).
     - Checks heading hierarchy and blocks duplicate H2/H3 headings.
     - Flags weak section objectives or missing questions answered.
     - Enforces minimum H2 depth (at least 3 sections required to prevent thin content).
     - Verifies presence of FAQs and practical takeaways.
     - Explicitly disclaims that internal quality heuristics are editorial safeguards and NOT official Google ranking algorithms.

3. **`src/services/ai/topic-outline-engine.ts` (New)**:
   - Orchestrates generation calls using `OllamaAdapter.generateStructuredOutput<T>()`:
     - `generateTopicAnalysis(input)`
     - `generateTopicCluster(input, analysis)`
     - `generateArticleOutline(input, analysis, cluster)`
   - Includes automatic retry and schema-correction prompting on validation failure.

4. **`src/app/api/v1/content/topic-outline/route.ts` (New API Route)**:
   - Authenticated multi-stage endpoint (`analyze_topic`, `generate_cluster`, `generate_outline`, `validate_outline`, `save_plan`).
   - Requires `content:write` permission.
   - Enforces multi-tenant ownership check (non-admin users cannot access or plan content for websites they do not own).
   - In `save_plan`: persists `KeywordCluster`, upserts supporting and focus `Keyword` records, creates `ContentBrief`, and creates an initial draft `Article` with version v1.
   - Records full audit trail via `recordAuditLog`.

5. **`src/components/dashboard/TopicOutlineWorkflow.tsx` (New Component)**:
   - 5-step interactive workflow in the dashboard:
     1. Topic Strategy & Targeting configuration.
     2. AI Topic Analysis review & entity inspection.
     3. Topic Cluster architecture & spoke articles review.
     4. Interactive outline editor (inline heading editing, adding/removing sections, re-validating against quality gate).
     5. Plan approval and database persistence.
   - Embedded directly inside `src/components/dashboard/DashboardShell.tsx` under the `Content Planner` and `AI Article Writer` views.

---

## 3. Automated Test Suites & Security Verification

Created two new comprehensive test suites:

1. **`tests/topic-outline-engine.test.ts` (6 Unit Tests)**:
   - Generates topic analysis using mocked adapter.
   - Generates topic clusters with pillar and spoke articles.
   - Generates complete article outlines with validation reports.
   - Flags duplicate headings with `BLOCKED` quality gate verdict.
   - Issues `WARNING` when title lacks primary focus keyword.
   - Blocks outlines with insufficient H2 depth (< 3 sections).

2. **`tests/topic-outline-api.test.ts` (3 API & Security Tests)**:
   - Validates outlines via `validate_outline` stage without calling external AI providers.
   - Persists `KeywordCluster`, `Keyword`, `ContentBrief`, and `Article` draft on `save_plan` with slug deduplication.
   - Enforces tenant isolation: rejects non-owner from managing another user's website with HTTP `403 Forbidden` (`FORBIDDEN_WEBSITE_ACCESS`).

---

## 4. Full Quality Gate Verification

| Verification Check | Command | Details | Exit Code |
|---|---|---|---|
| **TypeScript Strict Check** | `npm.cmd run typecheck` | 0 errors across entire workspace | **0** |
| **Prisma Schema Validation** | `npx.cmd prisma validate` | Schema valid (no extra tables) | **0** |
| **Topic Outline Engine Tests** | `npx.cmd vitest run tests/topic-outline-engine.test.ts` | 6/6 tests passed | **0** |
| **Topic Outline API & Security Tests** | `npx.cmd vitest run tests/topic-outline-api.test.ts` | 3/3 tests passed | **0** |
| **Full Regression Test Suite** | `npm.cmd test` | 11 test files passed, 66/66 tests passed | **0** |
| **Next.js Production Build** | `npm.cmd run build` | All 20 routes compiled successfully | **0** |

---

## 5. Compliance with Project Directives

- **Zero-Cost Policy:** Built exclusively on Ollama (`llama3.2`), with zero paid API keys or external SaaS dependencies.
- **Vercel-First Topology:** Serverless routes remain thin; long-running generation delegable to external Ollama worker.
- **Production Safety:** Production database and live deployments were untouched. Changes verified locally.
