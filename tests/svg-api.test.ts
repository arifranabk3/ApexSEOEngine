import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/v1/content/generate-svg/route";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken } from "@/lib/auth";

describe("Phase 02.1-E: SVG Media API & Article Integration Suite", () => {
  let adminCookie: string;
  let nonAdminCookie: string;
  let testArticleId: string;
  let otherArticleId: string;

  beforeEach(async () => {
    await ensureSystemSeeded();
    const db = await getDb();

    // Setup admin user & token
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

    // Setup non-admin editor
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

    let editorUser = await db.user.findUnique({ where: { email: "editor-svg@apexseo.local" } });
    if (!editorUser) {
      editorUser = await db.user.create({
        data: {
          email: "editor-svg@apexseo.local",
          name: "Editor SVG",
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

    // Setup website and test article
    const site = await db.website.findFirst();
    if (!site) throw new Error("No website in db");

    const article = await db.article.create({
      data: {
        websiteId: site.id,
        authorId: adminUser.id,
        title: "SVG Engine Integration Guide",
        slug: `svg-guide-${Date.now().toString().slice(-4)}`,
        content: "# SVG Guide content",
        status: "DRAFT"
      }
    });
    testArticleId = article.id;

    // Setup other tenant website and article
    let otherSite = await db.website.findUnique({ where: { url: "https://isolated-svg-tenant.com" } });
    if (!otherSite) {
      otherSite = await db.website.create({
        data: {
          name: "Isolated SVG Tenant",
          url: "https://isolated-svg-tenant.com",
          ownerId: adminUser.id // Owned by admin, not editor
        }
      });
    }

    const otherArticle = await db.article.create({
      data: {
        websiteId: otherSite.id,
        title: "Private Tenant Article",
        slug: `private-svg-${Date.now().toString().slice(-4)}`,
        content: "# Private Content",
        status: "DRAFT"
      }
    });
    otherArticleId = otherArticle.id;
  });

  it("previews an SVG featured image without database writes", async () => {
    const payload = {
      action: "preview_image",
      title: "Real-Time Ollama Performance",
      categoryName: "INFERENCE TELEMETRY",
      focusKeyword: "ollama performance",
      templateType: "CORE_WEB_VITALS"
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/generate-svg", {
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
    expect(json.data.asset.svgContent).toContain("<svg");
    expect(json.data.asset.templateType).toBe("CORE_WEB_VITALS");
    expect(json.data.security.isSanitized).toBe(true);
  });

  it("attaches generated SVG to an article, creating an ArticleImage record with alt text and dimensions", async () => {
    const payload = {
      action: "attach_to_article",
      articleId: testArticleId,
      title: "SVG Engine Integration Guide",
      templateType: "FEATURED_HERO",
      isFeatured: true,
      customAltText: "Custom alt text for featured hero illustration",
      customCaption: "Figure 1: Custom caption"
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/generate-svg", {
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
    expect(json.data.image).toBeDefined();
    expect(json.data.image.isFeatured).toBe(true);
    expect(json.data.image.altText).toBe("Custom alt text for featured hero illustration");
    expect(json.data.image.url).toContain("data:image/svg+xml");

    // Verify database record
    const db = await getDb();
    const saved = await db.articleImage.findUnique({ where: { id: json.data.image.id } });
    expect(saved).not.toBeNull();
    expect(saved?.articleId).toBe(testArticleId);
    expect(saved?.width).toBe(1200);
    expect(saved?.height).toBe(630);
  });

  it("enforces tenant isolation and forbids unauthorized editors from attaching images to another owner's article", async () => {
    const payload = {
      action: "attach_to_article",
      articleId: otherArticleId, // Owned by admin, user is editor
      title: "Unauthorized SVG Attachment",
      templateType: "FEATURED_HERO"
    };

    const req = new NextRequest("http://localhost:3000/api/v1/content/generate-svg", {
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
