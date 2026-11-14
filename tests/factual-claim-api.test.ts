import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/content/factual-review/route";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken } from "@/lib/auth";

describe("Phase 02.1-F3: Factual Review API & Security Suite", () => {
  let adminToken: string;
  let testArticleId: string;
  let otherArticleId: string;

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();

    const admin = await db.user.findUnique({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    if (!admin) throw new Error("Admin not found");

    adminToken = await createSessionToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      roleName: admin.role.name,
      permissions: admin.role.permissions.map((p) => p.code)
    });

    // Ensure a website exists
    let website = await db.website.findFirst();
    if (!website) {
      website = await db.website.create({
        data: {
          name: "Test Factual Website",
          url: "https://factual-test.example.com",
          ownerId: admin.id
        }
      });
    }

    // Create an article with numerical & technical claims
    const article = await db.article.create({
      data: {
        websiteId: website.id,
        title: "Database Performance & Benchmarking Report",
        slug: "db-performance-" + Date.now(),
        content: `
# Benchmarking Overview
The new PostgreSQL 16 cluster handled 18,500 transactions per second during stress testing.
Latency dropped by 35% compared to our legacy architecture.
However, [Internal Metrics](http://169.254.169.254/status) are unverified.
        `,
        seoScore: 75
      }
    });
    testArticleId = article.id;
  });

  it("audits raw markdown content without needing saved database records", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/content/factual-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `apexseo_session=${adminToken}`
      },
      body: JSON.stringify({
        action: "audit_raw_content",
        title: "Advisory Test",
        content: "Clinical trials prove this drug cures respiratory infections with 99.4% efficacy."
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.report.summary.criticalRiskCount).toBeGreaterThanOrEqual(1);
    expect(body.data.report.summary.readyForPublishing).toBe(false);
  });

  it("audits an existing database article and reports claims and risk levels", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/content/factual-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `apexseo_session=${adminToken}`
      },
      body: JSON.stringify({
        action: "audit_article",
        articleId: testArticleId
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.report.summary.totalClaims).toBeGreaterThanOrEqual(2);
    expect(body.data.report.claims.some((c: any) => c.category === "STATISTICAL_NUMERICAL")).toBe(true);
  });

  it("records a human editorial decision with reviewer audit logging", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/content/factual-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `apexseo_session=${adminToken}`
      },
      body: JSON.stringify({
        action: "record_reviewer_decision",
        articleId: testArticleId,
        claimId: "claim-1",
        decision: "ACCEPTED",
        reviewerNotes: "Verified via internal Datadog APM metrics dashboard."
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.decision).toBe("ACCEPTED");
    expect(body.data.reviewedBy).toBe("admin@apexseo.local");

    // Verify re-auditing retrieves this persistent decision
    const reAuditReq = new NextRequest("http://localhost:3000/api/v1/content/factual-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `apexseo_session=${adminToken}`
      },
      body: JSON.stringify({
        action: "audit_article",
        articleId: testArticleId
      })
    });
    const reAuditRes = await POST(reAuditReq);
    expect(reAuditRes.status).toBe(200);
    const reAuditBody = await reAuditRes.json();
    const persistedClaim = reAuditBody.data.report.claims.find((c: any) => c.id === "claim-1");
    expect(persistedClaim).toBeDefined();
    expect(persistedClaim.reviewerDecision).toBe("ACCEPTED");
    expect(persistedClaim.reviewerNotes).toBe("Verified via internal Datadog APM metrics dashboard.");
    expect(persistedClaim.reviewedBy).toBe("admin@apexseo.local");
  });

  it("rejects unauthorized access without valid session cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/content/factual-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "audit_article",
        articleId: testArticleId
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
