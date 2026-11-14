# APEX SEO ENGINE — PHASE C MODEL INVENTORY (ALL 21 REMAINING MODELS)

**Date:** 2026-11-14  
**Source Evidence:** `prisma/schema.prisma` (569 lines)  
**Database Target:** MongoDB Atlas (`apex_seo`)  
**Scope:** Complete inventory of the 21 models remaining after Phase B (`User`, `Role`, `Permission` already migrated).

---

## 1. Domain 1: Multi-Tenant Root & Integrations

### Model 1: `Website`
- **Current Table:** `Website`
- **Fields:** `id` (UUID), `name`, `url` (Unique), `cmsType` (WORDPRESS), `status` (ACTIVE), `encryptedCredentials`, `publishingConfig` (JSON), `seoConfig` (JSON), `ownerId` (FK -> User.id), `createdAt`, `updatedAt`.
- **Target Collection:** `websites`
- **Identifier Strategy:** `_id` (ObjectId) + `id` (UUID String for backwards compatibility).
- **Required Indexes:**
  - `{ url: 1 }` (Unique)
  - `{ id: 1 }` (Unique)
  - `{ ownerId: 1 }` (Tenant lookup index)
  - `{ status: 1 }`, `{ cmsType: 1 }`
- **Tenant Isolation:** Root isolation entity. All child documents reference `websiteId`.
- **Dependent Routes:** `/api/v1/websites`, `/api/v1/websites/[id]`, `/p/[websiteId]`.

### Model 2: `WebsiteIntegration`
- **Current Table:** `WebsiteIntegration`
- **Fields:** `id` (UUID), `websiteId` (FK), `type` (GSC | WORDPRESS), `status`, `encryptedCredentials`, `config` (JSON), `lastSyncAt`, `errorMessage`, `createdAt`, `updatedAt`.
- **Target Collection:** `website_integrations` (or embedded in `websites` array if 1-to-few).
- **Target Strategy:** Separate collection `website_integrations` with `{ websiteId: 1, type: 1 }` unique compound index.
- **Dependent Routes:** `/api/v1/integrations`.

---

## 2. Domain 2: AI Infrastructure

### Model 3: `AIProvider`
- **Current Table:** `AIProvider`
- **Fields:** `id` (UUID), `name`, `providerType` (OLLAMA, OPENAI, etc.), `baseUrl`, `encryptedApiKey`, `isEnabled`, `isDefault`, `rateLimitPerMin`, `createdAt`, `updatedAt`.
- **Target Collection:** `ai_providers`
- **Required Indexes:** `{ id: 1 }` (Unique), `{ providerType: 1 }`, `{ isDefault: 1 }`.
- **Dependent Routes:** `/api/v1/ai-providers`.

### Model 4: `AIModel`
- **Current Table:** `AIModel`
- **Fields:** `id` (UUID), `providerId` (FK -> AIProvider.id), `modelName`, `displayName`, `capability` (CHAT, COMPLETION, EMBEDDING), `contextWindow`, `costPer1kPrompt`, `costPer1kCompletion`, `isDefault`, `isEnabled`, `createdAt`, `updatedAt`.
- **Target Collection:** `ai_models`
- **Required Indexes:** `{ id: 1 }` (Unique), `{ providerId: 1 }`, compound `{ providerId: 1, modelName: 1 }` (Unique).
- **Dependent Routes:** `/api/v1/ai-providers`.

---

## 3. Domain 3: Keywords, Categories & Content Briefs

### Model 5: `Category`
- **Current Table:** `Category`
- **Fields:** `id`, `websiteId` (FK), `name`, `slug`, `description`, `parentId` (Self-referential FK), `createdAt`, `updatedAt`.
- **Target Collection:** `categories`
- **Required Indexes:** Compound `{ websiteId: 1, slug: 1 }` (Unique), `{ websiteId: 1 }`.

### Model 6: `KeywordCluster`
- **Current Table:** `KeywordCluster`
- **Fields:** `id`, `websiteId` (FK), `name`, `intent` (INFORMATIONAL, COMMERCIAL, etc.), `targetAudience`, `pillarKeywordId`, `createdAt`, `updatedAt`.
- **Target Collection:** `keyword_clusters`
- **Required Indexes:** `{ id: 1 }` (Unique), `{ websiteId: 1 }`.

### Model 7: `Keyword`
- **Current Table:** `Keyword`
- **Fields:** `id`, `websiteId` (FK), `clusterId` (FK nullable), `term`, `searchVolume`, `difficulty`, `cpc`, `intent`, `status` (DISCOVERED, PLANNED, PUBLISHED), `currentRank`, `createdAt`, `updatedAt`.
- **Target Collection:** `keywords`
- **Required Indexes:** Compound `{ websiteId: 1, term: 1 }` (Unique), `{ clusterId: 1 }`, `{ status: 1 }`.

### Model 8: `ContentBrief`
- **Current Table:** `ContentBrief`
- **Fields:** `id`, `websiteId` (FK), `keywordId` (FK), `title`, `slug`, `targetWordCount`, `outline` (JSON), `secondaryKeywords` (JSON), `competitorUrls` (JSON), `status`, `createdAt`, `updatedAt`.
- **Target Collection:** `content_briefs`
- **Required Indexes:** Compound `{ websiteId: 1, slug: 1 }` (Unique), `{ keywordId: 1 }`.

---

## 4. Domain 4: Articles, Versions & Media

### Model 9: `Article`
- **Current Table:** `Article` (Core publishing entity)
- **Fields:** `id`, `websiteId` (FK), `briefId` (FK), `categoryId` (FK), `authorId` (FK -> User.id), `title`, `slug`, `contentMarkdown`, `contentHtml`, `excerpt`, `metaTitle`, `metaDescription`, `featuredImageUrl`, `status` (DRAFT, PUBLISHED, etc.), `publishedAt`, `seoScore`, `readabilityScore`, `viewCount`, `currentVersion`, `createdAt`, `updatedAt`.
- **Target Collection:** `articles`
- **Required Indexes:** Compound `{ websiteId: 1, slug: 1 }` (Unique), `{ websiteId: 1, status: 1 }`, `{ authorId: 1 }`.
- **Dependent Routes:** `/api/v1/content`, `/p/[websiteId]/[slug]`.

### Model 10: `ArticleVersion`
- **Current Table:** `ArticleVersion`
- **Fields:** `id`, `articleId` (FK), `versionNumber`, `title`, `contentMarkdown`, `contentHtml`, `changeSummary`, `authorId`, `createdAt`.
- **Target Collection:** `article_versions` (Kept separate from `articles` to avoid 16MB document limits on revision-heavy articles).
- **Required Indexes:** Compound `{ articleId: 1, versionNumber: -1 }` (Unique).

### Model 11: `ArticleImage`
- **Current Table:** `ArticleImage`
- **Fields:** `id`, `articleId` (FK), `url`, `altText`, `caption`, `isFeatured`, `imageType` (SVG_INFOGRAPHIC, HERO, DIAGRAM), `svgCode`, `createdAt`.
- **Target Collection:** `article_images` (or embedded in `articles.images` array).

---

## 5. Domain 5: SEO Graph & Publishing Pipeline

### Model 12: `InternalLink`
- **Current Table:** `InternalLink`
- **Fields:** `id`, `websiteId` (FK), `sourceArticleId` (FK), `targetArticleId` (FK), `anchorText`, `relevanceScore`, `status` (ACTIVE, BROKEN), `createdAt`.
- **Target Collection:** `internal_links`
- **Required Indexes:** `{ websiteId: 1 }`, `{ sourceArticleId: 1 }`, `{ targetArticleId: 1 }`.

### Model 13: `PublishingJob`
- **Current Table:** `PublishingJob`
- **Fields:** `id`, `websiteId` (FK), `articleId` (FK), `status` (PENDING, PROCESSING, COMPLETED, FAILED), `externalPostId`, `externalUrl`, `retryCount`, `maxRetries`, `errorMessage`, `scheduledFor`, `publishedAt`, `createdAt`.
- **Target Collection:** `publishing_jobs`
- **Required Indexes:** Compound `{ status: 1, scheduledFor: 1 }`, `{ articleId: 1 }`.
- **Dependent Routes:** `/api/v1/jobs`.

---

## 6. Domain 6: Automation & Schedulers

### Model 14: `AutomationWorkflow`
- **Current Table:** `AutomationWorkflow`
- **Fields:** `id`, `websiteId` (FK), `name`, `triggerType` (SCHEDULE, EVENT), `cronSchedule`, `steps` (JSON), `isEnabled`, `lastRunAt`, `nextRunAt`, `createdAt`.
- **Target Collection:** `automation_workflows`
- **Required Indexes:** `{ websiteId: 1 }`, `{ isEnabled: 1, nextRunAt: 1 }`.
- **Dependent Routes:** `/api/v1/automations`.

### Model 15: `AutomationExecution`
- **Current Table:** `AutomationExecution`
- **Fields:** `id`, `workflowId` (FK), `status` (RUNNING, SUCCESS, FAILED), `inputPayload` (JSON), `outputPayload` (JSON), `startedAt`, `completedAt`, `errorMessage`.
- **Target Collection:** `automation_executions`
- **Required Indexes:** `{ workflowId: 1, startedAt: -1 }`.

### Model 16: `DurableJob`
- **Current Table:** `DurableJob`
- **Fields:** `id`, `type`, `status` (PENDING, PROCESSING, FAILED, COMPLETED), `payload` (JSON), `lockedUntil`, `lockedBy`, `retryCount`, `createdAt`.
- **Target Collection:** `durable_jobs`
- **Required Indexes:** Compound `{ status: 1, lockedUntil: 1 }` (Atomic claim queue index).
- **Dependent Services:** `durable-job-queue.ts`.

### Model 17: `JobSchedule`
- **Current Table:** `JobSchedule`
- **Fields:** `id`, `jobType`, `cronExpression`, `enabled`, `lastQueuedAt`, `createdAt`.
- **Target Collection:** `job_schedules`
- **Required Indexes:** `{ jobType: 1 }` (Unique).

### Model 18: `SchedulerRun`
- **Current Table:** `SchedulerRun`
- **Fields:** `id`, `runKey`, `status`, `jobsEnqueued`, `durationMs`, `createdAt`.
- **Target Collection:** `scheduler_runs`
- **Required Indexes:** `{ runKey: 1 }` (Unique).

---

## 7. Domain 7: Analytics, Settings & System Logs

### Model 19: `SearchPerformance`
- **Current Table:** `SearchPerformance`
- **Fields:** `id`, `websiteId` (FK), `date`, `clicks`, `impressions`, `ctr`, `position`, `query`, `pageUrl`, `createdAt`.
- **Target Collection:** `search_performance`
- **Required Indexes:** Compound `{ websiteId: 1, date: -1 }`, compound `{ websiteId: 1, query: 1 }`.
- **Dependent Routes:** `/api/v1/compliance`, `/api/v1/dashboard`.

### Model 20: `SystemSetting`
- **Current Table:** `SystemSetting`
- **Fields:** `id`, `key` (Unique), `value` (JSON), `category`, `description`, `isEncrypted`, `createdAt`, `updatedAt`.
- **Target Collection:** `system_settings`
- **Required Indexes:** `{ key: 1 }` (Unique), `{ category: 1 }`.
- **Dependent Routes:** `/api/v1/settings`.

### Model 21: `AuditLog`
- **Current Table:** `AuditLog`
- **Fields:** `id`, `userId` (FK nullable), `action`, `module`, `ipAddress`, `metadata` (JSON), `createdAt`.
- **Target Collection:** `audit_logs`
- **Required Indexes:** `{ userId: 1, createdAt: -1 }`, `{ module: 1 }`, TTL index on `createdAt` (90 days).
- **Dependent Services:** `audit.ts`.
