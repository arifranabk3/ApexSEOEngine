import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { encryptJsonCredentials, encryptSecret } from "@/lib/crypto";
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";
import { getContentBriefRepository } from "@/repositories/content-brief-repository.factory";
import { getArticleRepository } from "@/repositories/article-repository.factory";

const DEFAULT_PERMISSIONS = [
  { code: "websites:read", module: "websites", action: "read", description: "View websites" },
  { code: "websites:write", module: "websites", action: "write", description: "Create and edit websites" },
  { code: "websites:delete", module: "websites", action: "delete", description: "Delete websites" },
  { code: "ai:read", module: "ai", action: "read", description: "View AI providers and models" },
  { code: "ai:write", module: "ai", action: "write", description: "Configure AI providers and models" },
  { code: "content:read", module: "content", action: "read", description: "View articles and categories" },
  { code: "content:write", module: "content", action: "write", description: "Create and edit articles" },
  { code: "automations:read", module: "automations", action: "read", description: "View automation workflows" },
  { code: "automations:write", module: "automations", action: "write", description: "Manage and trigger workflows" },
  { code: "integrations:write", module: "integrations", action: "write", description: "Configure CMS and GSC integrations" },
  { code: "settings:read", module: "settings", action: "read", description: "View system settings" },
  { code: "settings:write", module: "settings", action: "write", description: "Update system settings" }
];

let seedPromise: Promise<void> | null = null;

export async function ensureSystemSeeded(): Promise<void> {
  // If running in production on Vercel without MONGODB_URI configured, bypass seeding to preserve uptime
  if (!process.env.MONGODB_URI) {
    return;
  }

  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    const db = await getDb();

    // 1. Seed Permissions
    for (const perm of DEFAULT_PERMISSIONS) {
      await db.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm
      });
    }

    const allPermissions = await db.permission.findMany();

    // 2. Seed Roles
    const superAdminRole = await db.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: {
        name: "SUPER_ADMIN",
        description: "Full administrative access across all modules and system settings",
        isSystem: true,
        permissions: {
          connect: allPermissions.map((p) => ({ id: p.id }))
        }
      }
    });

    await db.role.upsert({
      where: { name: "EDITOR" },
      update: {
        permissions: {
          set: allPermissions
            .filter((p) => p.module === "content" || (p.action === "read" && p.module !== "settings"))
            .map((p) => ({ id: p.id }))
        }
      },
      create: {
        name: "EDITOR",
        description: "Manage content, keywords, and publishing pipelines",
        isSystem: true,
        permissions: {
          connect: allPermissions
            .filter((p) => p.module === "content" || (p.action === "read" && p.module !== "settings"))
            .map((p) => ({ id: p.id }))
        }
      }
    });

    await db.role.upsert({
      where: { name: "VIEWER" },
      update: {
        permissions: {
          set: allPermissions
            .filter((p) => p.action === "read" && p.module !== "settings")
            .map((p) => ({ id: p.id }))
        }
      },
      create: {
        name: "VIEWER",
        description: "Read-only access to dashboards and reports",
        isSystem: true,
        permissions: {
          connect: allPermissions
            .filter((p) => p.action === "read" && p.module !== "settings")
            .map((p) => ({ id: p.id }))
        }
      }
    });

    // 3. Seed Default Admin User
    const adminEmail = "admin@apexseo.local";
    let adminUser = await db.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@12345";
      const passwordHash = await hashPassword(initialPassword);
      adminUser = await db.user.create({
        data: {
          email: adminEmail,
          name: "Principal SEO Architect",
          passwordHash,
          isActive: true,
          mustChangePassword: true, // Mandatory password rotation on first login
          tokenVersion: 0,
          roleId: superAdminRole.id
        }
      });
    } else if (adminUser.passwordChangedAt === null && !adminUser.mustChangePassword) {
      // If admin was seeded prior to the security hardening migration and has never changed password,
      // enforce the mandatory password rotation requirement
      adminUser = await db.user.update({
        where: { id: adminUser.id },
        data: { mustChangePassword: true }
      });
    }

    // 4. Seed Default Local Ollama AI Provider (Zero-Cost Policy) via Mongo Repository
    const defaultOllamaUrl = process.env.DEFAULT_OLLAMA_BASE_URL || "http://localhost:11434";
    const aiConfigRepo = getAIConfigRepository();
    const ollamaProvider = await aiConfigRepo.upsertProvider({
      name: "Local Ollama Engine",
      providerType: "OLLAMA",
      baseUrl: defaultOllamaUrl,
      isLocal: true,
      isEnabled: true,
      status: "READY",
      config: {
        zeroCostCompliant: true,
        timeoutMs: 30000
      }
    });

    await aiConfigRepo.upsertModel({
      providerId: ollamaProvider.id,
      name: "Llama 3.2 (Local 8B)",
      modelId: "llama3.2:latest",
      capabilities: ["text", "clustering", "briefs", "seo-optimization"],
      contextWindow: 128000,
      temperature: 0.6,
      isDefault: true,
      isEnabled: true
    });

    await aiConfigRepo.upsertModel({
      providerId: ollamaProvider.id,
      name: "Nomic Embed Text (Local Semantic Clustering)",
      modelId: "nomic-embed-text:latest",
      capabilities: ["embeddings", "clustering", "internal-linking"],
      contextWindow: 8192,
      temperature: 0.0,
      isDefault: false,
      isEnabled: true
    });

    // 5. Seed Default Primary Website & Categories if none exist
    const websiteCount = await db.website.count();
    if (websiteCount === 0) {
      const primaryWebsite = await db.website.create({
        data: {
          name: "Apex Tech Journal",
          url: "https://apextech.example.com",
          cmsType: "WORDPRESS",
          status: "ACTIVE",
          ownerId: adminUser.id,
          encryptedCredentials: encryptJsonCredentials({
            username: "seo_publisher",
            appPassword: "xxxx-xxxx-xxxx-xxxx"
          }),
          publishingConfig: {
            defaultStatus: "draft",
            autoPublishApproved: false,
            requireFeaturedImage: true
          },
          seoConfig: {
            defaultAuthor: "Editorial Team",
            requireSearchIntentAlignment: true,
            requireSourceCitations: true,
            enforceHelpfulContentGate: true
          }
        }
      });

      await db.websiteIntegration.createMany({
        data: [
          {
            websiteId: primaryWebsite.id,
            integrationType: "WORDPRESS",
            name: "WordPress REST API v2",
            endpointUrl: "https://apextech.example.com/wp-json/wp/v2",
            encryptedCredentials: encryptJsonCredentials({
              username: "seo_publisher",
              appPassword: "xxxx-xxxx-xxxx-xxxx"
            }),
            status: "CONFIGURED"
          },
          {
            websiteId: primaryWebsite.id,
            integrationType: "GSC",
            name: "Google Search Console Property",
            endpointUrl: "sc-domain:apextech.example.com",
            encryptedCredentials: encryptJsonCredentials({
              clientEmail: "gsc-sync@apextech-seo.iam.gserviceaccount.com"
            }),
            status: "CONFIGURED"
          },
          {
            websiteId: primaryWebsite.id,
            integrationType: "N8N",
            name: "n8n Community Webhook Bridge",
            endpointUrl: "http://localhost:5678/webhook/seo-pipeline",
            encryptedCredentials: encryptSecret("n8n-local-webhook-secret"),
            status: "CONFIGURED"
          }
        ]
      });

      const keywordRepo = getKeywordDomainRepository();

      const catArchitecture = await keywordRepo.upsertCategory({
        websiteId: primaryWebsite.id,
        name: "AI & Automation",
        slug: "ai-automation",
        description: "Open-source AI workflows and technical SEO guides"
      });

      const cluster = await keywordRepo.createCluster({
        websiteId: primaryWebsite.id,
        name: "Local LLM SEO Automation",
        pillarKeyword: "open source ai seo automation",
        intent: "INFORMATIONAL",
        status: "ACTIVE"
      });

      const keyword = await keywordRepo.upsertKeyword({
        websiteId: primaryWebsite.id,
        clusterId: cluster.id,
        term: "self hosted seo automation with ollama",
        searchIntent: "INFORMATIONAL",
        searchVolume: 0,
        difficulty: 0,
        status: "TRACKED"
      });

      const contentBriefRepo = getContentBriefRepository();
      const brief = await contentBriefRepo.upsertBrief({
        websiteId: primaryWebsite.id,
        keywordId: keyword.id,
        clusterId: cluster.id,
        title: "How to Build a Self-Hosted AI SEO Pipeline with Ollama & n8n",
        targetWordCount: 1800,
        searchIntent: "INFORMATIONAL",
        outline: [
          "H2: Zero-Cost SEO Architecture Principles",
          "H2: Connecting Local Ollama Models",
          "H2: Automating WordPress Publishing with n8n Community Edition"
        ],
        status: "APPROVED"
      });

      const articleRepo = getArticleRepository();
      const existingSeedArt = await articleRepo.findArticleBySlug(
        primaryWebsite.id,
        "self-hosted-ai-seo-pipeline-ollama-n8n"
      );
      if (!existingSeedArt) {
        await articleRepo.createArticle({
          websiteId: primaryWebsite.id,
          categoryId: catArchitecture.id,
          briefId: brief.id,
          authorId: adminUser.id,
          title: "How to Build a Self-Hosted AI SEO Pipeline with Ollama & n8n",
          slug: "self-hosted-ai-seo-pipeline-ollama-n8n",
          excerpt: "Architectural blueprint for running a zero-cost SEO content engine using PostgreSQL, Ollama, and n8n.",
          content: "# How to Build a Self-Hosted AI SEO Pipeline with Ollama & n8n\n\nThis foundational article demonstrates versioned content storage, SEO metadata tracking, and multi-CMS readiness in Phase 01.",
          status: "DRAFT",
          focusKeyword: "self hosted seo automation with ollama",
          metaTitle: "Self-Hosted AI SEO Pipeline with Ollama & n8n (Zero-Cost Guide)",
          metaDescription: "Learn how to architect a scalable zero-cost SEO automation system with local LLMs, n8n Community Edition, and WordPress REST API.",
          seoScore: 88,
          wordCount: 410,
          initialVersion: {
            title: "How to Build a Self-Hosted AI SEO Pipeline with Ollama & n8n",
            content: "# How to Build a Self-Hosted AI SEO Pipeline with Ollama & n8n\n\nThis foundational article demonstrates versioned content storage, SEO metadata tracking, and multi-CMS readiness in Phase 01.",
            metaTitle: "Self-Hosted AI SEO Pipeline with Ollama & n8n (Zero-Cost Guide)",
            metaDesc: "Learn how to architect a scalable zero-cost SEO automation system with local LLMs, n8n Community Edition, and WordPress REST API.",
            changeSummary: "Initial Phase 01 foundation draft",
            createdBy: adminUser.email
          }
        });
      }

      // 6. Seed Default Automation Workflows
      await db.automationWorkflow.upsert({
        where: { slug: "gsc-daily-query-sync" },
        update: {},
        create: {
          websiteId: primaryWebsite.id,
          name: "Google Search Console Daily Query Sync",
          slug: "gsc-daily-query-sync",
          description: "Pulls organic queries, impressions, clicks, and average positions via official free GSC API.",
          workflowType: "N8N_WEBHOOK",
          n8nWorkflowId: "wf-gsc-001",
          webhookUrl: "http://localhost:5678/webhook/gsc-daily-sync",
          scheduleCron: "0 4 * * *",
          isEnabled: true,
          status: "IDLE",
          maxRetries: 3,
          retryBackoffMs: 5000
        }
      });

      await db.automationWorkflow.upsert({
        where: { slug: "cms-publishing-queue-worker" },
        update: {},
        create: {
          websiteId: primaryWebsite.id,
          name: "CMS Scheduled Publishing Worker",
          slug: "cms-publishing-queue-worker",
          description: "Dispatches approved articles to WordPress REST API or Custom CMS adapters with exponential backoff.",
          workflowType: "INTERNAL_CRON",
          scheduleCron: "*/15 * * * *",
          isEnabled: true,
          status: "IDLE",
          maxRetries: 3,
          retryBackoffMs: 10000
        }
      });
    }

    // 6b. Ensure Public Showcase Published Articles exist in PostgreSQL for the Frontend Website
    const primarySite = await db.website.findFirst({ orderBy: { createdAt: "asc" } });
    if (primarySite) {
      const keywordRepo = getKeywordDomainRepository();
      const catTech = await keywordRepo.upsertCategory({
        websiteId: primarySite.id,
        name: "Technical SEO & Architecture",
        slug: "technical-seo-architecture",
        description: "Google Search Essentials, Core Web Vitals, and Vercel-First publishing blueprints"
      });

      const catAdsense = await keywordRepo.upsertCategory({
        websiteId: primarySite.id,
        name: "Publisher & AdSense Compliance",
        slug: "publisher-compliance",
        description: "E-E-A-T verification, ads.txt governance, and Invalid Traffic (IVT) protection"
      });

      const showcaseArticles = [
        {
          slug: "zero-cost-ai-seo-stack-postgresql-ollama-n8n",
          title: "Architecting a Zero-Cost AI SEO Stack with PostgreSQL 16, Ollama, and n8n Community",
          categoryId: catTech.id,
          focusKeyword: "zero cost ai seo stack",
          metaTitle: "Zero-Cost AI SEO Stack with PostgreSQL 16, Ollama & n8n (2026 Blueprint)",
          metaDescription:
            "Complete engineering guide to building a provider-independent AI SEO and content publishing system using PostgreSQL 16, local Ollama LLMs, and n8n Community Edition.",
          excerpt:
            "Discover how to eliminate expensive SaaS subscriptions by combining external managed PostgreSQL, local Llama 3.2 inference, and durable background workers.",
          seoScore: 96,
          wordCount: 1420,
          content: `<h2>1. Why Modern Engineering Teams Are Moving to Zero-Cost SEO Stacks</h2>
<p>Commercial SEO platforms and proprietary AI content wrappers routinely cost thousands of dollars per month while locking publishers into rigid templates that violate Google's <strong>Scaled Content Abuse</strong> policies. By owning the database schema in PostgreSQL 16 and decoupling the AI inference layer, engineering teams gain complete transparency and zero recurring API fees.</p>

<h2>2. Decoupled Vercel-First Topology &amp; Durable Job Queues</h2>
<p>A production-grade publishing platform must never run long-lived loops inside stateless serverless functions. Instead, our architecture separates responsibilities into three independent layers:</p>
<ol>
  <li><strong>Vercel Next.js Frontend &amp; Public Publication</strong>: Serves both the public magazine website and the administrative control plane with sub-second response times.</li>
  <li><strong>External Managed PostgreSQL 16</strong>: Stores 21 normalized models including multi-website isolation boundaries, versioned articles, and the <code>DurableJob</code> queue.</li>
  <li><strong>Standalone Automation Worker Service</strong>: Polls or receives HMAC-SHA256 signed dispatches to execute keyword research, AI drafting, technical SEO audits, and CMS publishing with exponential backoff.</li>
</ol>

<h2>3. Enforcing Google Search Essentials Before Every Publish</h2>
<p>Every article generated or edited in the platform must pass a deterministic 13-point technical and on-page audit before its status can transition from <code>DRAFT</code> to <code>PUBLISHED</code>. This includes verifying single-H1 hierarchy, canonical URL parity, external HTTPS citations (<a href="https://developers.google.com/search/docs/essentials">Google Search Essentials</a>), and 4-gram Jaccard originality checks.</p>`
        },
        {
          slug: "google-adsense-publisher-readiness-eeat-engineering-guide",
          title: "Google AdSense Publisher Readiness: Engineering E-E-A-T, ads.txt, and Invalid Traffic Guards",
          categoryId: catAdsense.id,
          focusKeyword: "google adsense publisher readiness guide",
          metaTitle: "Google AdSense Publisher Readiness: E-E-A-T, ads.txt & IVT Protection",
          metaDescription:
            "How to engineer technical compliance for Google AdSense and Publisher Policies: mandatory trust pages, IAB ads.txt validation, CLS-safe ad slots, and IVT protection.",
          excerpt:
            "An independent engineering checklist for passing Google AdSense pre-application reviews and protecting publisher accounts from invalid traffic penalties.",
          seoScore: 95,
          wordCount: 1280,
          content: `<h2>1. Separating Search Ranking Signals from AdSense Program Policies</h2>
<p>A common misconception in automated publishing is assuming that a high SEO score guarantees Google AdSense approval. In reality, Google Search Essentials and Google Publisher Policies are enforced by completely separate systems. Our platform runs an independent <strong>AdSense Compliance Engine</strong> alongside the Technical SEO engine.</p>

<h2>2. Mandatory Publisher Identity &amp; Transparency Pages</h2>
<p>Before submitting any domain for AdSense review, the readiness auditor verifies that the public website exposes clear, indexable trust pages:</p>
<ol>
  <li><strong>About Us &amp; Editorial Policy</strong>: Documents human editorial oversight, fact-checking standards, and author credentials.</li>
  <li><strong>Privacy Policy &amp; CMP Consent</strong>: Discloses cookie usage, third-party ad serving, and Consent Management Platform (CMP) controls.</li>
  <li><strong>Verified IAB Authorized Digital Sellers (ads.txt)</strong>: Ensures the root <code>/ads.txt</code> record matches the exact <code>pub-XXXXXXXXXXXXXXXX</code> publisher identifier.</li>
</ol>

<h2>3. Preventing Layout Shift (CLS) and Accidental Clicks</h2>
<p>Ad containers must never be placed deceptively close to navigation buttons or disguised as editorial links. By reserving explicit minimum block heights on ad slots and monitoring bot traffic ratios, publishers maintain both Core Web Vitals health and long-term AdSense account standing.</p>`
        },
        {
          slug: "core-web-vitals-structured-data-parity-nextjs-15",
          title: "Core Web Vitals & JSON-LD Structured Data Parity in Next.js 15 Publishing Systems",
          categoryId: catTech.id,
          focusKeyword: "nextjs 15 json ld structured data parity",
          metaTitle: "Core Web Vitals & JSON-LD Parity in Next.js 15 Publishing Platforms",
          metaDescription:
            "Learn how to validate Article, FAQPage, and BreadcrumbList JSON-LD against visible DOM content while maintaining optimal LCP, INP, and CLS performance.",
          excerpt:
            "Prevent structured data spam penalties by ensuring every JSON-LD property strictly matches visible HTML content rendered to readers.",
          seoScore: 94,
          wordCount: 1190,
          content: `<h2>1. Why Misleading Structured Data Triggers Manual Actions</h2>
<p>Injecting <code>Article</code> or <code>FAQPage</code> JSON-LD markup that does not match the visible text on the page is a direct violation of Google's Structured Data General Guidelines. Automated SEO systems must validate parity between the JSON-LD payload and the rendered DOM before publishing.</p>

<h2>2. Optimizing LCP, INP, and CLS on Content-Heavy Pages</h2>
<p>High-performing technical publications keep Largest Contentful Paint (LCP) fast by avoiding render-blocking scripts, specifying explicit <code>width</code> and <code>height</code> attributes on every <code>ArticleImage</code>, and using modern responsive typography that scales cleanly across mobile and desktop viewports.</p>`
        }
      ];

      const articleRepo = getArticleRepository();
      for (const item of showcaseArticles) {
        await articleRepo.upsertArticle({
          websiteId: primarySite.id,
          categoryId: item.categoryId,
          authorId: adminUser.id,
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          content: item.content,
          status: "PUBLISHED",
          focusKeyword: item.focusKeyword,
          metaTitle: item.metaTitle,
          metaDescription: item.metaDescription,
          canonicalUrl: `${primarySite.url.replace(/\/$/, "")}/${item.slug}`,
          seoScore: item.seoScore,
          wordCount: item.wordCount,
          externalPostId: `pub-${item.slug}`,
          publishedUrl: `/p/${primarySite.id}/${item.slug}`,
          publishedAt: new Date(),
          initialVersion: {
            title: item.title,
            content: item.content,
            metaTitle: item.metaTitle,
            metaDesc: item.metaDescription,
            changeSummary: "Seeded showcase published article"
          }
        });
      }
    }

    // 7. Seed System Settings
    const defaultSettings = [
      {
        category: "GENERAL",
        key: "general.platformName",
        value: "ApexSEO Autonomous Engine",
        isSecret: false,
        description: "Display name of the SEO Automation Platform"
      },
      {
        category: "GENERAL",
        key: "general.zeroCostPolicyEnforced",
        value: true,
        isSecret: false,
        description: "Strictly block paid API integrations and enforce open-source/local adapters"
      },
      {
        category: "SECURITY",
        key: "security.sessionTimeoutHours",
        value: 24,
        isSecret: false,
        description: "HTTP-only JWT session validity duration in hours"
      },
      {
        category: "SECURITY",
        key: "security.rateLimitRequestsPerMinute",
        value: 180,
        isSecret: false,
        description: "Maximum API requests per IP per minute"
      },
      {
        category: "AI",
        key: "ai.defaultProvider",
        value: "Local Ollama Engine",
        isSecret: false,
        description: "Primary AI provider used for clustering, briefs, and article drafting"
      },
      {
        category: "AI",
        key: "ai.defaultTemperature",
        value: 0.6,
        isSecret: false,
        description: "Default sampling temperature for SEO article generation"
      },
      {
        category: "PUBLISHING",
        key: "publishing.defaultPostStatus",
        value: "draft",
        isSecret: false,
        description: "Default status when pushing articles to WordPress or custom CMS"
      },
      {
        category: "AUTOMATION",
        key: "automation.n8nBaseUrl",
        value: process.env.N8N_BASE_URL || "http://localhost:5678",
        isSecret: false,
        description: "Self-hosted n8n Community Edition base URL"
      },
      {
        category: "AUTOMATION",
        key: "automation.defaultMaxRetries",
        value: 3,
        isSecret: false,
        description: "Default retry attempts for failed workflow executions"
      },
      {
        category: "SECURITY",
        key: "security.auditHmacSecret",
        value: "internal-hmac-salt-key-do-not-reveal",
        isSecret: true,
        description: "Internal cryptographic HMAC seed for audit integrity verification"
      }
    ];

    for (const s of defaultSettings) {
      await db.systemSetting.upsert({
        where: { key: s.key },
        update: {},
        create: s
      });
    }
  })();

  return seedPromise;
}

