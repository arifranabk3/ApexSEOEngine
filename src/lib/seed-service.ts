import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { encryptJsonCredentials, encryptSecret } from "@/lib/crypto";

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
      update: {},
      create: {
        name: "EDITOR",
        description: "Manage content, keywords, and publishing pipelines",
        isSystem: true,
        permissions: {
          connect: allPermissions
            .filter((p) => p.module === "content" || p.action === "read")
            .map((p) => ({ id: p.id }))
        }
      }
    });

    await db.role.upsert({
      where: { name: "VIEWER" },
      update: {},
      create: {
        name: "VIEWER",
        description: "Read-only access to dashboards and reports",
        isSystem: true,
        permissions: {
          connect: allPermissions
            .filter((p) => p.action === "read")
            .map((p) => ({ id: p.id }))
        }
      }
    });

    // 3. Seed Default Admin User
    const adminEmail = "admin@apexseo.local";
    let adminUser = await db.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      const passwordHash = await hashPassword("Admin@12345");
      adminUser = await db.user.create({
        data: {
          email: adminEmail,
          name: "Principal SEO Architect",
          passwordHash,
          isActive: true,
          roleId: superAdminRole.id
        }
      });
    }

    // 4. Seed Default Local Ollama AI Provider (Zero-Cost Policy)
    const defaultOllamaUrl = process.env.DEFAULT_OLLAMA_BASE_URL || "http://localhost:11434";
    const ollamaProvider = await db.aIProvider.upsert({
      where: { name: "Local Ollama Engine" },
      update: {},
      create: {
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
      }
    });

    await db.aIModel.upsert({
      where: {
        providerId_modelId: {
          providerId: ollamaProvider.id,
          modelId: "llama3.2:latest"
        }
      },
      update: {},
      create: {
        providerId: ollamaProvider.id,
        name: "Llama 3.2 (Local 8B)",
        modelId: "llama3.2:latest",
        capabilities: ["text", "clustering", "briefs", "seo-optimization"],
        contextWindow: 128000,
        temperature: 0.6,
        isDefault: true,
        isEnabled: true
      }
    });

    await db.aIModel.upsert({
      where: {
        providerId_modelId: {
          providerId: ollamaProvider.id,
          modelId: "nomic-embed-text:latest"
        }
      },
      update: {},
      create: {
        providerId: ollamaProvider.id,
        name: "Nomic Embed Text (Local Semantic Clustering)",
        modelId: "nomic-embed-text:latest",
        capabilities: ["embeddings", "clustering", "internal-linking"],
        contextWindow: 8192,
        temperature: 0.0,
        isDefault: false,
        isEnabled: true
      }
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

      const catArchitecture = await db.category.create({
        data: {
          websiteId: primaryWebsite.id,
          name: "AI & Automation",
          slug: "ai-automation",
          description: "Open-source AI workflows and technical SEO guides"
        }
      });

      const cluster = await db.keywordCluster.create({
        data: {
          websiteId: primaryWebsite.id,
          name: "Local LLM SEO Automation",
          pillarKeyword: "open source ai seo automation",
          intent: "INFORMATIONAL",
          status: "ACTIVE"
        }
      });

      const keyword = await db.keyword.create({
        data: {
          websiteId: primaryWebsite.id,
          clusterId: cluster.id,
          term: "self hosted seo automation with ollama",
          searchIntent: "INFORMATIONAL",
          searchVolume: 0,
          difficulty: 0,
          status: "TRACKED"
        }
      });

      const brief = await db.contentBrief.create({
        data: {
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
        }
      });

      const article = await db.article.create({
        data: {
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
          wordCount: 410
        }
      });

      await db.articleVersion.create({
        data: {
          articleId: article.id,
          versionNumber: 1,
          title: article.title,
          content: article.content,
          metaTitle: article.metaTitle,
          metaDesc: article.metaDescription,
          changeSummary: "Initial Phase 01 foundation draft",
          createdBy: adminUser.email
        }
      });

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

