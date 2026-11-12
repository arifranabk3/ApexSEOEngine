# ApexSEO Autonomous Engine — Phase 01 Master Foundation

A production-ready, zero-cost AI SEO Automation Platform foundation built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS**, **PostgreSQL 16 (Prisma ORM)**, **n8n Community Edition**, and **local Ollama AI adapters**.

---

## 1. Zero-Cost Policy Compliance

This platform strictly enforces a **Zero-Cost Development Policy**:
- **AI Inference**: Defaults to self-hosted **Ollama** (`http://localhost:11434`) and OpenAI-compatible local engines (LM Studio, vLLM, llama.cpp).
- **Workflow Automation**: Self-hosted **n8n Community Edition** (`http://localhost:5678`) with an internal scheduled worker fallback.
- **Database**: Self-hosted **PostgreSQL 16** (Docker Compose) + automatic embedded **PGlite** PostgreSQL 16 wire-compatible daemon for instant zero-config local execution.
- **CMS & Analytics**: Official free **WordPress REST API v2** (Application Passwords), custom headless REST/Webhook CMS adapters, and official free **Google Search Console API**.
- **Paid API Alternatives Documented**:
  - *Keyword Research & SERP Metrics*: Replaced by Google Search Console Search Analytics API + Autocomplete + local semantic embeddings (`nomic-embed-text`).
  - *On-Page Optimization*: Replaced by deterministic HTML/Markdown rubric + local LLM semantic scoring.
  - *Featured Image Generation*: Replaced by local Stable Diffusion / ComfyUI API or programmatic SVG/Canvas generator.

---

## 2. System Architecture & Modules (Phase 01)

| Module | Status | Key Capabilities |
| :--- | :--- | :--- |
| **A. Authentication & RBAC** | Complete | Bcrypt password hashing, HTTP-only signed JWT sessions, RBAC roles (`SUPER_ADMIN`, `EDITOR`, `VIEWER`), granular permissions, login rate limiting, CSRF Origin checks |
| **B. Dashboard UI** | Complete | 15-section responsive sidebar navigation, light/dark mode, real database metrics, honest empty states (zero fake metrics), live automation & audit feeds |
| **C. Website Management** | Complete | Multi-website CRUD, CMS selection (`WORDPRESS`, `CUSTOM_REST`, `GHOST`, `HEADLESS`), AES-256-GCM encrypted credentials, website-level data isolation |
| **D. AI Provider Management** | Complete | Provider-independent adapter layer (`OllamaAdapter`, `OpenAICompatibleAdapter`), model registry, live connection latency testing, usage counters |
| **E. Automation Management** | Complete | Workflow registry, cron scheduling, n8n webhook dispatcher, exponential retry backoff calculator, execution history logs |
| **F. Content Management** | Complete | Article repository, draft creation, immutable `ArticleVersion` snapshots, category hierarchy, SEO metadata storage |
| **G. Integration Management** | Complete | Encrypted integration vault for WordPress REST API, Google Search Console, GA4, and n8n |
| **H. System Settings** | Complete | Categorized persistent settings (`GENERAL`, `SECURITY`, `AI`, `PUBLISHING`, `AUTOMATION`) with secret masking and audit logs |

---

## 3. Normalized Database Schema (20 Models)

Defined in [`prisma/schema.prisma`](prisma/schema.prisma) and migrated via [`prisma/migrations/20261112000000_init_phase01/migration.sql`](prisma/migrations/20261112000000_init_phase01/migration.sql):

1. `User`
2. `Role`
3. `Permission`
4. `Website`
5. `WebsiteIntegration`
6. `AIProvider`
7. `AIModel`
8. `Keyword`
9. `KeywordCluster`
10. `ContentBrief`
11. `Article`
12. `ArticleVersion`
13. `ArticleImage`
14. `Category`
15. `InternalLink`
16. `PublishingJob`
17. `AutomationWorkflow`
18. `AutomationExecution`
19. `SearchPerformance`
20. `SystemSetting` & `AuditLog`

---

## 4. Quick Start & Developer Commands

```bash
# 1. Install dependencies
npm install

# 2. Initialize & migrate local PostgreSQL schema
npm run db:setup-local

# 3. Seed RBAC roles, default admin, Ollama provider, sample website & workflows
npm run db:seed

# 4. Run development server (http://localhost:3000)
npm run dev
```

### Default Local Administrator Credentials
- **Email**: `admin@apexseo.local`
- **Password**: `Admin@12345`

### Verification & Testing Commands
```bash
# TypeScript validation
npm run typecheck

# Unit, Security, Database & REST API integration tests
npm test

# Production build verification
npm run build

# Full Docker Compose Stack (PostgreSQL 16 + n8n Community + Ollama + App)
docker compose up -d
```

