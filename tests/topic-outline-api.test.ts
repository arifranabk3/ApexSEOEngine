import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/v1/content/topic-outline/route";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken } from "@/lib/auth";

describe("Phase 02.1-C: Topic Outline API & Security Suite", () => {
  let adminCookie: string;
  let nonAdminCookie: string;
  let testWebsiteId: string;
  let otherWebsiteId: string;

  beforeEach(async () => {
    await ensureSystemSeeded();
    const db = await getDb();

    // Setup admin user & cookie
    const adminUser = await db.user.findFirst({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    if (!adminUser) throw new Error("Admin user not found");

    const adminToken = await createSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roleName: adminUser.role.name,
      permissions: adminUser.role.permissions.map((p) => p.code),
      tokenVersion: adminUser.tokenVersion
    });
    adminCookie = `apexseo_session=${adminToken}`;

    // Setup non-admin user
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
            connect: [
              { code: "content:read" },
              { code: "content:write" }
            ]
          }
        },
        include: { permissions: true }
      });
    }

    let editorUser = await db.user.findUnique({
      where: { email: "editor-test@apexseo.local" }
    });
    if (!editorUser) {
      editorUser = await db.user.create({
        data: {
          email: "editor-test@apexseo.local",
          name: "Test Editor",
          passwordHash: "dummy-hash",
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

    // Setup website belonging to admin
    const site = await db.website.findFirst();
    if (!site) throw new Error("No website in db");
    testWebsiteId = site.id;

    // Setup a private website belonging to another user
    let otherSite = await db.website.findUnique({ where: { url: "https://other-private-tenant.com" } });
    if (!otherSite) {
      otherSite = await db.website.create({
        data: {
          name: "Other Tenant Site",
          url: "https://other-private-tenant.com",
          ownerId: adminUser.id // Owned by admin, not editor
        }
      });
    }
    otherWebsiteId = otherSite.id;
  });

  it("validates outline via validate_outline stage without requiring AI provider", async () => {
    const payload = {
      stage: "validate_outline",
      input: {
        websiteId: testWebsiteId,
        mainTopic: "Self-Hosted Ollama",
        focusKeyword: "ollama guide"
      },
      outline: {
        seoTitle: "Self-Hosted Ollama Guide for Developers",
        metaDescription: "Comprehensive walkthrough of running Ollama locally with zero cost and structured output validation.",
        urlSlug: "self-hosted-ollama-guide",
        h1: "Self-Hosted Ollama Guide for Developers",
        sections: [
          {
            heading: "Introduction to Local LLMs",
            level: "h2",
            objective: "Introduction to offline models",
            questionsAnswered: ["What is Ollama?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          },
          {
            heading: "Hardware Requirements & GPU Selection",
            level: "h2",
            objective: "Examine VRAM and CPU requirements",
            questionsAnswered: ["How much RAM is needed?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          },
          {
            heading: "Integration Architecture with Next.js",
            level: "h2",
            objective: "Connect REST API to local daemon",
            questionsAnswered: ["How to call Ollama from Node?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          }
        ],
        conclusionObjective: "Summarize steps to launch",
        practicalTakeaways: ["Check GPU drivers", "Use structured schema"],
        faqs: [
          { question: "Is Ollama free?", answerBrief: "Yes, completely free and open source." },
          { question: "Does it work on Windows?", answerBrief: "Yes, native Windows installer exists." }
        ],
        imageSuggestions: [],
        externalReferenceOpportunities: []
      }
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/topic-outline", {
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
    expect(json.data.validation.verdict).toBe("PASS");
    expect(json.data.validation.score).toBe(100);
  });

  it("persists topic cluster, keywords, content brief, and article draft on save_plan", async () => {
    const payload = {
      stage: "save_plan",
      websiteId: testWebsiteId,
      keyword: "local llama3.2 guide",
      cluster: {
        clusterName: "Local Llama 3.2 Strategy",
        pillarTopic: "Complete Guide to Local Llama 3.2",
        pillarKeyword: "local llama3.2 guide",
        intent: "INFORMATIONAL",
        supportingArticles: [
          {
            title: "Llama 3.2 1B vs 3B Benchmarks",
            targetKeyword: "llama 3.2 benchmarks",
            intent: "INFORMATIONAL",
            relationshipToPillar: "Benchmark comparison",
            plannedSlug: "llama-3-2-benchmarks"
          },
          {
            title: "Prompt Engineering for Llama 3.2",
            targetKeyword: "llama 3.2 prompt engineering",
            intent: "INFORMATIONAL",
            relationshipToPillar: "Prompting techniques",
            plannedSlug: "llama-3-2-prompting"
          },
          {
            title: "Deploying Llama 3.2 with Docker",
            targetKeyword: "docker llama 3.2",
            intent: "INFORMATIONAL",
            relationshipToPillar: "Containerization",
            plannedSlug: "docker-llama-3-2"
          }
        ],
        internalLinkingStrategy: "Bidirectional links between pillar and spokes",
        keywordOverlapNotes: "Disjoint search intents avoid cannibalization",
        duplicateTopicRisks: []
      },
      outline: {
        seoTitle: "Local Llama 3.2 Guide: Complete Self-Hosted Setup",
        metaDescription: "Step-by-step tutorial to configure and run Meta Llama 3.2 locally using Ollama and TypeScript.",
        urlSlug: "local-llama-3-2-guide",
        h1: "Complete Guide to Local Llama 3.2 Setup",
        sections: [
          {
            heading: "Overview of Llama 3.2 Models",
            level: "h2",
            objective: "Explain 1B and 3B model capabilities",
            questionsAnswered: ["What is new in Llama 3.2?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          },
          {
            heading: "Local Installation & Setup",
            level: "h2",
            objective: "Show ollama run commands",
            questionsAnswered: ["How to download Llama 3.2?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          },
          {
            heading: "Production Performance Optimization",
            level: "h2",
            objective: "Tips for low-latency inference",
            questionsAnswered: ["How to optimize tokens per second?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          }
        ],
        conclusionObjective: "Final wrap-up",
        practicalTakeaways: ["Use GPU acceleration", "Select appropriate quant"],
        faqs: [
          { question: "Is Llama 3.2 commercial?", answerBrief: "Yes, under Llama 3.2 Community License." },
          { question: "What is minimum RAM?", answerBrief: "4GB RAM for 1B model." }
        ],
        imageSuggestions: [],
        externalReferenceOpportunities: []
      },
      createArticleDraft: true
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/topic-outline", {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.briefId).toBeDefined();
    expect(json.data.clusterId).toBeDefined();
    expect(json.data.articleId).toBeDefined();

    // Verify in database
    const db = await getDb();
    const savedBrief = await db.contentBrief.findUnique({ where: { id: json.data.briefId } });
    expect(savedBrief).not.toBeNull();
    expect(savedBrief?.status).toBe("APPROVED");

    const savedArticle = await db.article.findUnique({ where: { id: json.data.articleId } });
    expect(savedArticle).not.toBeNull();
    expect(savedArticle?.status).toBe("DRAFT");
    expect(savedArticle?.focusKeyword).toBe("local llama3.2 guide");
  });

  it("enforces tenant isolation and rejects non-owner from managing another user's website", async () => {
    const payload = {
      stage: "validate_outline",
      input: {
        websiteId: otherWebsiteId, // Owned by admin, user is editor
        mainTopic: "Unauthorized Outline",
        focusKeyword: "hack"
      },
      outline: {
        seoTitle: "Unauthorized Outline Title That Meets Length Requirements",
        metaDescription: "Unauthorized outline meta description that is long enough to satisfy all basic constraints.",
        urlSlug: "unauthorized-outline",
        h1: "Unauthorized Outline",
        sections: [
          { heading: "Section 1", level: "h2", objective: "Objective for section 1", questionsAnswered: ["What is this?"], suggestedExamples: [], internalLinkAnchorRecommendations: [], subsections: [] },
          { heading: "Section 2", level: "h2", objective: "Objective for section 2", questionsAnswered: ["How does this work?"], suggestedExamples: [], internalLinkAnchorRecommendations: [], subsections: [] },
          { heading: "Section 3", level: "h2", objective: "Objective for section 3", questionsAnswered: ["Where is this used?"], suggestedExamples: [], internalLinkAnchorRecommendations: [], subsections: [] }
        ],
        conclusionObjective: "Concl conclusion objective that is long enough",
        practicalTakeaways: ["T1 takeaway actionable", "T2 takeaway actionable"],
        faqs: [
          { question: "Q1?", answerBrief: "A1" },
          { question: "Q2?", answerBrief: "A2" }
        ],
        imageSuggestions: [],
        externalReferenceOpportunities: []
      }
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/topic-outline", {
      method: "POST",
      headers: {
        Cookie: nonAdminCookie,
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
