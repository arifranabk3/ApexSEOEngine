-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cmsType" TEXT NOT NULL DEFAULT 'WORDPRESS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "encryptedCredentials" TEXT,
    "publishingConfig" JSONB NOT NULL DEFAULT '{}',
    "seoConfig" JSONB NOT NULL DEFAULT '{}',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteIntegration" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "encryptedCredentials" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'OLLAMA',
    "baseUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "isLocal" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'UNTESTED',
    "lastCheckedAt" TIMESTAMP(3),
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '["text"]',
    "contextWindow" INTEGER NOT NULL DEFAULT 8192,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordCluster" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillarKeyword" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'INFORMATIONAL',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "clusterId" TEXT,
    "term" TEXT NOT NULL,
    "searchIntent" TEXT NOT NULL DEFAULT 'INFORMATIONAL',
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPosition" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'TRACKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keywordId" TEXT,
    "clusterId" TEXT,
    "title" TEXT NOT NULL,
    "targetWordCount" INTEGER NOT NULL DEFAULT 1500,
    "searchIntent" TEXT NOT NULL DEFAULT 'INFORMATIONAL',
    "outline" JSONB NOT NULL DEFAULT '[]',
    "secondaryKeywords" JSONB NOT NULL DEFAULT '[]',
    "competitorNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "briefId" TEXT,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "focusKeyword" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "seoScore" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "externalPostId" TEXT,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "changeSummary" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleImage" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "caption" TEXT,
    "prompt" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'LOCAL_GENERATOR',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER NOT NULL DEFAULT 1200,
    "height" INTEGER NOT NULL DEFAULT 630,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalLink" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceArticleId" TEXT NOT NULL,
    "targetArticleId" TEXT NOT NULL,
    "anchorText" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "cmsType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "remotePostId" TEXT,
    "publishedUrl" TEXT,
    "errorMessage" TEXT,
    "responseLog" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "workflowType" TEXT NOT NULL DEFAULT 'N8N_WEBHOOK',
    "n8nWorkflowId" TEXT,
    "webhookUrl" TEXT,
    "scheduleCron" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 5000,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "inputPayload" JSONB NOT NULL DEFAULT '{}',
    "outputResult" JSONB NOT NULL DEFAULT '{}',
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT,
    "jobType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 10,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "errorLog" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DurableJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchPerformance" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "articleId" TEXT,
    "keywordId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RolePermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_module_action_idx" ON "Permission"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Website_url_key" ON "Website"("url");

-- CreateIndex
CREATE INDEX "Website_ownerId_idx" ON "Website"("ownerId");

-- CreateIndex
CREATE INDEX "Website_status_idx" ON "Website"("status");

-- CreateIndex
CREATE INDEX "Website_cmsType_idx" ON "Website"("cmsType");

-- CreateIndex
CREATE INDEX "WebsiteIntegration_websiteId_idx" ON "WebsiteIntegration"("websiteId");

-- CreateIndex
CREATE INDEX "WebsiteIntegration_status_idx" ON "WebsiteIntegration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteIntegration_websiteId_integrationType_key" ON "WebsiteIntegration"("websiteId", "integrationType");

-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_name_key" ON "AIProvider"("name");

-- CreateIndex
CREATE INDEX "AIProvider_providerType_idx" ON "AIProvider"("providerType");

-- CreateIndex
CREATE INDEX "AIProvider_isEnabled_idx" ON "AIProvider"("isEnabled");

-- CreateIndex
CREATE INDEX "AIModel_providerId_idx" ON "AIModel"("providerId");

-- CreateIndex
CREATE INDEX "AIModel_isDefault_idx" ON "AIModel"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_providerId_modelId_key" ON "AIModel"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "KeywordCluster_websiteId_idx" ON "KeywordCluster"("websiteId");

-- CreateIndex
CREATE INDEX "KeywordCluster_status_idx" ON "KeywordCluster"("status");

-- CreateIndex
CREATE INDEX "Keyword_websiteId_idx" ON "Keyword"("websiteId");

-- CreateIndex
CREATE INDEX "Keyword_clusterId_idx" ON "Keyword"("clusterId");

-- CreateIndex
CREATE INDEX "Keyword_status_idx" ON "Keyword"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_websiteId_term_key" ON "Keyword"("websiteId", "term");

-- CreateIndex
CREATE INDEX "ContentBrief_websiteId_idx" ON "ContentBrief"("websiteId");

-- CreateIndex
CREATE INDEX "ContentBrief_keywordId_idx" ON "ContentBrief"("keywordId");

-- CreateIndex
CREATE INDEX "ContentBrief_status_idx" ON "ContentBrief"("status");

-- CreateIndex
CREATE INDEX "Category_websiteId_idx" ON "Category"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_websiteId_slug_key" ON "Category"("websiteId", "slug");

-- CreateIndex
CREATE INDEX "Article_websiteId_status_idx" ON "Article"("websiteId", "status");

-- CreateIndex
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");

-- CreateIndex
CREATE INDEX "Article_briefId_idx" ON "Article"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_websiteId_slug_key" ON "Article"("websiteId", "slug");

-- CreateIndex
CREATE INDEX "ArticleVersion_articleId_idx" ON "ArticleVersion"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVersion_articleId_versionNumber_key" ON "ArticleVersion"("articleId", "versionNumber");

-- CreateIndex
CREATE INDEX "ArticleImage_articleId_idx" ON "ArticleImage"("articleId");

-- CreateIndex
CREATE INDEX "InternalLink_websiteId_idx" ON "InternalLink"("websiteId");

-- CreateIndex
CREATE INDEX "InternalLink_sourceArticleId_idx" ON "InternalLink"("sourceArticleId");

-- CreateIndex
CREATE INDEX "InternalLink_targetArticleId_idx" ON "InternalLink"("targetArticleId");

-- CreateIndex
CREATE INDEX "PublishingJob_websiteId_status_idx" ON "PublishingJob"("websiteId", "status");

-- CreateIndex
CREATE INDEX "PublishingJob_articleId_idx" ON "PublishingJob"("articleId");

-- CreateIndex
CREATE INDEX "PublishingJob_scheduledFor_idx" ON "PublishingJob"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationWorkflow_slug_key" ON "AutomationWorkflow"("slug");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_websiteId_idx" ON "AutomationWorkflow"("websiteId");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_status_idx" ON "AutomationWorkflow"("status");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_isEnabled_idx" ON "AutomationWorkflow"("isEnabled");

-- CreateIndex
CREATE INDEX "AutomationExecution_workflowId_status_idx" ON "AutomationExecution"("workflowId", "status");

-- CreateIndex
CREATE INDEX "AutomationExecution_startedAt_idx" ON "AutomationExecution"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DurableJob_idempotencyKey_key" ON "DurableJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DurableJob_status_nextRetryAt_priority_idx" ON "DurableJob"("status", "nextRetryAt", "priority");

-- CreateIndex
CREATE INDEX "DurableJob_websiteId_jobType_idx" ON "DurableJob"("websiteId", "jobType");

-- CreateIndex
CREATE INDEX "DurableJob_lockedUntil_idx" ON "DurableJob"("lockedUntil");

-- CreateIndex
CREATE INDEX "SearchPerformance_websiteId_date_idx" ON "SearchPerformance"("websiteId", "date");

-- CreateIndex
CREATE INDEX "SearchPerformance_articleId_idx" ON "SearchPerformance"("articleId");

-- CreateIndex
CREATE INDEX "SearchPerformance_keywordId_idx" ON "SearchPerformance"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchPerformance_websiteId_pageUrl_query_date_key" ON "SearchPerformance"("websiteId", "pageUrl", "query", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_module_action_idx" ON "AuditLog"("module", "action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_RolePermissions_AB_unique" ON "_RolePermissions"("A", "B");

-- CreateIndex
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteIntegration" ADD CONSTRAINT "WebsiteIntegration_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIModel" ADD CONSTRAINT "AIModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordCluster" ADD CONSTRAINT "KeywordCluster_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ContentBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalLink" ADD CONSTRAINT "InternalLink_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalLink" ADD CONSTRAINT "InternalLink_sourceArticleId_fkey" FOREIGN KEY ("sourceArticleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalLink" ADD CONSTRAINT "InternalLink_targetArticleId_fkey" FOREIGN KEY ("targetArticleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingJob" ADD CONSTRAINT "PublishingJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingJob" ADD CONSTRAINT "PublishingJob_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableJob" ADD CONSTRAINT "DurableJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

