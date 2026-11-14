import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/v1/content/generate-modular/route";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken } from "@/lib/auth";

describe("Phase 02.1-D: Modular Generation API & Versioning Suite", () => {
  let adminCookie: string;
  let nonAdminCookie: string;
  let testArticleId: string;
  let otherArticleId: string;

  beforeEach(async () => {
    await ensureSystemSeeded();
    const db = await getDb();

    // 1. Setup Admin User
    const adminUser = await db.user.findFirst({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    if (!adminUser) throw new Error("Admin not found");

    const adminToken = await createSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roleName: adminUser.role.name,
      permissions: adminUser.role.permissions.map((p) => p.code),
      tokenVersion: adminUser.tokenVersion
    });
    adminCookie = `apexseo_session=${adminToken}`;

    // 2. Setup Non-Admin Editor
    let editorRole = await db.role.findFirst({
      where: { name: "EDITOR" },
      include: { permissions: true }
    });
    if (!editorRole) {
      editorRole = await db.role.create({
        data: {
          name: "EDITOR",
          description: "Editor Role",
          permissions: {
            connect: [{ code: "content:read" }, { code: "content:write" }]
          }
        },
        include: { permissions: true }
      });
    }

    let editorUser = await db.user.findUnique({ where: { email: "editor-mod@apexseo.local" } });
    if (!editorUser) {
      editorUser = await db.user.create({
        data: {
          email: "editor-mod@apexseo.local",
          name: "Editor Mod",
          passwordHash: "hash",
          roleId: editorRole.id
        }
      });
    }

    const editorToken = await createSessionToken({
      id: editorUser.id,
      email: editorUser.email,
      name: editorUser.name,
      roleName: editorRole.name,
      permissions: editorRole.permissions.map((p) => p.code),
      tokenVersion: editorUser.tokenVersion
    });
    nonAdminCookie = `apexseo_session=${editorToken}`;

    // 3. Setup Test Website and Article with ContentBrief
    const site = await db.website.findFirst();
    if (!site) throw new Error("No website in db");

    const brief = await db.contentBrief.create({
      data: {
        websiteId: site.id,
        title: "Modular AI Article Guide",
        searchIntent: "INFORMATIONAL",
        status: "APPROVED",
        outline: {
          seoTitle: "Modular AI Article Generation: Complete Architecture",
          metaDescription: "Comprehensive guide to assembling high-authority technical articles module by module.",
          urlSlug: "modular-ai-article-generation-guide",
          h1: "Modular AI Article Generation: Complete Architecture",
          sections: [
            {
              heading: "Introduction to Modular Content",
              level: "h2",
              objective: "Explain benefits of piece-by-piece generation.",
              questionsAnswered: ["Why avoid monolithic prompts?"],
              suggestedExamples: [],
              internalLinkAnchorRecommendations: [],
              subsections: []
            }
          ],
          conclusionObjective: "Final summary",
          practicalTakeaways: ["Use Zod schemas", "Save versions"],
          faqs: [{ question: "Is this deterministic?", answerBrief: "Yes, via temperature and schema constraints." }],
          imageSuggestions: [],
          externalReferenceOpportunities: []
        }
      }
    });

    const article = await db.article.create({
      data: {
        websiteId: site.id,
        briefId: brief.id,
        authorId: adminUser.id,
        title: "Modular AI Article Generation: Complete Architecture",
        slug: `modular-guide-${Date.now().toString().slice(-4)}`,
        content: "# Placeholder initial draft",
        status: "DRAFT",
        versions: {
          create: {
            versionNumber: 1,
            title: "Modular AI Article Generation: Complete Architecture",
            content: "# Placeholder initial draft",
            changeSummary: "Initial outline placeholder",
            createdBy: adminUser.email
          }
        }
      }
    });
    testArticleId = article.id;

    // 4. Setup Isolated Tenant Article
    let otherSite = await db.website.findUnique({ where: { url: "https://isolated-mod-tenant.com" } });
    if (!otherSite) {
      otherSite = await db.website.create({
        data: {
          name: "Isolated Mod Tenant",
          url: "https://isolated-mod-tenant.com",
          ownerId: adminUser.id // Owned by admin, not editor
        }
      });
    }

    const otherArticle = await db.article.create({
      data: {
        websiteId: otherSite.id,
        title: "Private Tenant Article",
        slug: `private-art-${Date.now().toString().slice(-4)}`,
        content: "# Private Content",
        status: "DRAFT"
      }
    });
    otherArticleId = otherArticle.id;
  });

  it("assembles article and creates new ArticleVersion incrementing versionNumber", async () => {
    const payload = {
      action: "assemble_and_save",
      articleId: testArticleId,
      changeSummary: "First completed modular assembly v2",
      sections: [
        {
          heading: "Introduction to Modular Content",
          level: "h2",
          markdownContent: "Monolithic prompting often results in shallow, unfocused articles. Breaking content into discrete sections guarantees depth and allows human review at every stage.",
          keyTakeaways: ["Discrete section generation prevents token exhaustion", "Enforces strict technical depth"],
          unverifiedClaims: ["UNVERIFIED: Benchmark claim: 40% higher reader retention"],
          citedEntitiesOrSources: ["Next.js", "Ollama"],
          wordCount: 120
        },
        {
          heading: "Conclusion & Key Takeaways",
          level: "h2",
          markdownContent: "Modular content architectures represent the future of verifiable, enterprise-grade automated publishing.",
          keyTakeaways: ["Complete review available", "Preserves version history"],
          unverifiedClaims: [],
          citedEntitiesOrSources: [],
          wordCount: 85
        }
      ]
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/generate-modular", {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.article).toBeDefined();
    expect(json.data.assembled.wordCount).toBeGreaterThan(50);
    expect(json.data.assembled.allUnverifiedClaims).toContain("UNVERIFIED: Benchmark claim: 40% higher reader retention");

    // Verify database version bump
    const db = await getDb();
    const versions = await db.articleVersion.findMany({
      where: { articleId: testArticleId },
      orderBy: { versionNumber: "desc" }
    });

    expect(versions.length).toBe(2);
    expect(versions[0].versionNumber).toBe(2);
    expect(versions[0].changeSummary).toContain("First completed modular assembly v2");
  });

  it("enforces tenant isolation and forbids unauthorized editors from assembling another owner's article", async () => {
    const payload = {
      action: "assemble_and_save",
      articleId: otherArticleId,
      sections: [
        {
          heading: "Unauthorized Section",
          level: "h2",
          markdownContent: "Unauthorized prose that is long enough to satisfy the fifty character minimum content length requirement.",
          keyTakeaways: [],
          unverifiedClaims: [],
          citedEntitiesOrSources: [],
          wordCount: 50
        }
      ]
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/generate-modular", {
      method: "POST",
      headers: {
        Cookie: nonAdminCookie, // editor user
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN_WEBSITE_ACCESS");
  });
});
