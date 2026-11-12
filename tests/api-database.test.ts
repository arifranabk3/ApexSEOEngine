import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET as healthGet } from "@/app/api/v1/health/route";
import { POST as loginPost } from "@/app/api/v1/auth/login/route";
import { GET as dashboardGet } from "@/app/api/v1/dashboard/route";
import { GET as websitesGet, POST as websitesPost } from "@/app/api/v1/websites/route";
import { GET as providersGet } from "@/app/api/v1/ai-providers/route";
import { GET as contentGet, POST as contentPost } from "@/app/api/v1/content/route";
import { GET as automationsGet, PUT as automationsPut } from "@/app/api/v1/automations/route";
import { GET as settingsGet, PUT as settingsPut } from "@/app/api/v1/settings/route";

function buildAuthedRequest(
  url: string,
  token: string,
  method = "GET",
  body?: Record<string, unknown>
): NextRequest {
  const headers = new Headers({
    Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    Authorization: `Bearer ${token}`,
    Host: "localhost:3000",
    Origin: "http://localhost:3000"
  });
  if (body) {
    headers.set("Content-Type", "application/json");
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("Database & REST API Integration Suite (Phase 01)", () => {
  let adminToken = "";
  let primaryWebsiteId = "";

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();
    const admin = await db.user.findUnique({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    expect(admin).toBeTruthy();

    adminToken = await createSessionToken({
      id: admin!.id,
      email: admin!.email,
      name: admin!.name,
      roleName: admin!.role.name,
      permissions: admin!.role.permissions.map((p) => p.code)
    });

    const firstSite = await db.website.findFirst();
    primaryWebsiteId = firstSite!.id;
  });

  it("verifies all 20 normalized PostgreSQL models are queryable", async () => {
    const db = await getDb();
    const userCount = await db.user.count();
    const roleCount = await db.role.count();
    const permCount = await db.permission.count();
    const siteCount = await db.website.count();
    const intCount = await db.websiteIntegration.count();
    const aiProvCount = await db.aIProvider.count();
    const aiModelCount = await db.aIModel.count();
    const kwCount = await db.keyword.count();
    const clusterCount = await db.keywordCluster.count();
    const briefCount = await db.contentBrief.count();
    const artCount = await db.article.count();
    const verCount = await db.articleVersion.count();
    const imgCount = await db.articleImage.count();
    const catCount = await db.category.count();
    const linkCount = await db.internalLink.count();
    const pubJobCount = await db.publishingJob.count();
    const wfCount = await db.automationWorkflow.count();
    const execCount = await db.automationExecution.count();
    const perfCount = await db.searchPerformance.count();
    const settingCount = await db.systemSetting.count();
    const auditCount = await db.auditLog.count();

    expect(userCount).toBeGreaterThanOrEqual(1);
    expect(roleCount).toBeGreaterThanOrEqual(3);
    expect(permCount).toBeGreaterThanOrEqual(10);
    expect(siteCount).toBeGreaterThanOrEqual(1);
    expect(intCount).toBeGreaterThanOrEqual(3);
    expect(aiProvCount).toBeGreaterThanOrEqual(1);
    expect(aiModelCount).toBeGreaterThanOrEqual(2);
    expect(kwCount).toBeGreaterThanOrEqual(1);
    expect(clusterCount).toBeGreaterThanOrEqual(1);
    expect(briefCount).toBeGreaterThanOrEqual(1);
    expect(artCount).toBeGreaterThanOrEqual(1);
    expect(verCount).toBeGreaterThanOrEqual(1);
    expect(imgCount).toBeGreaterThanOrEqual(0);
    expect(catCount).toBeGreaterThanOrEqual(1);
    expect(linkCount).toBeGreaterThanOrEqual(0);
    expect(pubJobCount).toBeGreaterThanOrEqual(0);
    expect(wfCount).toBeGreaterThanOrEqual(2);
    expect(execCount).toBeGreaterThanOrEqual(0);
    expect(perfCount).toBeGreaterThanOrEqual(0);
    expect(settingCount).toBeGreaterThanOrEqual(9);
    expect(auditCount).toBeGreaterThanOrEqual(0);
  });

  it("responds healthy on /api/v1/health", async () => {
    const res = await healthGet();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("healthy");
    expect(json.data.zeroCostPolicy).toBe("ENFORCED");
  });

  it("authenticates valid credentials on /api/v1/auth/login and rejects invalid ones", async () => {
    const badReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@apexseo.local", password: "wrongpassword" })
    });
    const badRes = await loginPost(badReq);
    expect(badRes.status).toBe(401);

    const goodReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@apexseo.local", password: "Admin@12345" })
    });
    const goodRes = await loginPost(goodReq);
    const goodJson = await goodRes.json();
    expect(goodRes.status).toBe(200);
    expect(goodJson.success).toBe(true);
    expect(goodJson.data.user.roleName).toBe("SUPER_ADMIN");
  });

  it("loads dashboard metrics without fake performance data", async () => {
    const req = buildAuthedRequest("http://localhost:3000/api/v1/dashboard", adminToken);
    const res = await dashboardGet(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.totalWebsites).toBeGreaterThanOrEqual(1);
    expect(json.data.seoPerformanceOverview.hasData).toBe(false);
  });

  it("creates and retrieves websites with encrypted credentials masked", async () => {
    const uniqueUrl = `https://test-${Date.now()}.example.com`;
    const postReq = buildAuthedRequest(
      "http://localhost:3000/api/v1/websites",
      adminToken,
      "POST",
      {
        name: "Automated Test Property",
        url: uniqueUrl,
        cmsType: "WORDPRESS",
        credentials: {
          username: "wp_bot",
          appPassword: "super_secret_wp_password"
        }
      }
    );
    const postRes = await websitesPost(postReq);
    const postJson = await postRes.json();
    expect(postRes.status).toBe(201);
    expect(postJson.data.credentialsConfigured).toBe(true);
    expect(JSON.stringify(postJson)).not.toContain("super_secret_wp_password");

    const getReq = buildAuthedRequest("http://localhost:3000/api/v1/websites", adminToken);
    const getRes = await websitesGet(getReq);
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThanOrEqual(2);
  });

  it("lists AI providers and models", async () => {
    const req = buildAuthedRequest("http://localhost:3000/api/v1/ai-providers", adminToken);
    const res = await providersGet(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data[0].providerType).toBe("OLLAMA");
    expect(json.data[0].models.length).toBeGreaterThanOrEqual(2);
  });

  it("creates versioned articles and triggers automation workflows", async () => {
    const slug = `test-article-${Date.now()}`;
    const createArtReq = buildAuthedRequest(
      "http://localhost:3000/api/v1/content",
      adminToken,
      "POST",
      {
        websiteId: primaryWebsiteId,
        title: "Zero Cost SEO Architecture Test Article",
        slug,
        focusKeyword: "zero cost seo architecture",
        content: "# Zero Cost SEO\n\nFull markdown body for integration verification."
      }
    );
    const createArtRes = await contentPost(createArtReq);
    const createArtJson = await createArtRes.json();
    expect(createArtRes.status).toBe(201);
    expect(createArtJson.data.versions.length).toBe(1);

    const listArtReq = buildAuthedRequest("http://localhost:3000/api/v1/content", adminToken);
    const listArtRes = await contentGet(listArtReq);
    expect(listArtRes.status).toBe(200);

    const wfReq = buildAuthedRequest("http://localhost:3000/api/v1/automations", adminToken);
    const wfRes = await automationsGet(wfReq);
    const wfJson = await wfRes.json();
    expect(wfJson.data.length).toBeGreaterThanOrEqual(2);

    const triggerReq = buildAuthedRequest(
      "http://localhost:3000/api/v1/automations",
      adminToken,
      "PUT",
      { workflowId: wfJson.data[0].id }
    );
    const triggerRes = await automationsPut(triggerReq);
    const triggerJson = await triggerRes.json();
    expect(triggerRes.status).toBe(200);
    expect(triggerJson.data.execution.status).toBe("SUCCESS");
  });

  it("persists and retrieves system settings", async () => {
    const updateReq = buildAuthedRequest(
      "http://localhost:3000/api/v1/settings",
      adminToken,
      "PUT",
      {
        settings: [
          {
            category: "AI",
            key: "ai.defaultTemperature",
            value: 0.5,
            isSecret: false,
            description: "Updated temperature via integration test"
          }
        ]
      }
    );
    const updateRes = await settingsPut(updateReq);
    expect(updateRes.status).toBe(200);

    const getReq = buildAuthedRequest("http://localhost:3000/api/v1/settings", adminToken);
    const getRes = await settingsGet(getReq);
    const getJson = await getRes.json();
    const updatedSetting = getJson.data.find(
      (s: { key: string }) => s.key === "ai.defaultTemperature"
    );
    expect(updatedSetting.value).toBe(0.5);
  });
});

