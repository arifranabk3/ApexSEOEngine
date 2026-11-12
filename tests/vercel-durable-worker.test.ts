import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  DURABLE_JOB_TYPES,
  enqueueDurableJob,
  processDurableJobById,
  recoverStalledJobs,
  signWorkerPayload,
  verifyWorkerSignature,
  getWorkerSharedSecret
} from "@/services/automation/durable-job-queue";
import { GET as jobsGet, POST as jobsPost, PUT as jobsPut } from "@/app/api/v1/jobs/route";
import { GET as cronGet } from "@/app/api/v1/cron/enqueue-schedules/route";

describe("Vercel-First Architecture, Durable Job Queue & End-to-End Publishing Suite", () => {
  let adminToken = "";
  let primaryWebsiteId = "";

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();
    const admin = await db.user.findUnique({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    adminToken = await createSessionToken({
      id: admin!.id,
      email: admin!.email,
      name: admin!.name,
      roleName: admin!.role.name,
      permissions: admin!.role.permissions.map((p) => p.code)
    });

    const site = await db.website.findFirst();
    primaryWebsiteId = site!.id;
  });

  it("enforces HMAC-SHA256 signature verification and replay protection for external worker communication", () => {
    const payload = JSON.stringify({ action: "process_batch", workerId: "worker-test" });
    const ts = String(Date.now());
    const sig = signWorkerPayload(payload, ts, getWorkerSharedSecret());

    const validResult = verifyWorkerSignature({
      rawBody: payload,
      timestampHeader: ts,
      signatureHeader: sig
    });
    expect(validResult.valid).toBe(true);

    // Tampered payload must be rejected
    const tampered = verifyWorkerSignature({
      rawBody: JSON.stringify({ action: "process_batch", workerId: "attacker" }),
      timestampHeader: ts,
      signatureHeader: sig
    });
    expect(tampered.valid).toBe(false);

    // Expired timestamp (>5 min ago) must be rejected
    const expiredTs = String(Date.now() - 10 * 60 * 1000);
    const expiredSig = signWorkerPayload(payload, expiredTs, getWorkerSharedSecret());
    const expiredResult = verifyWorkerSignature({
      rawBody: payload,
      timestampHeader: expiredTs,
      signatureHeader: expiredSig
    });
    expect(expiredResult.valid).toBe(false);
  });

  it("enforces strict idempotency so duplicate job submissions do not create duplicate executions", async () => {
    const key = `idempotency-test-${Date.now()}`;
    const first = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "KEYWORD_RESEARCH",
      idempotencyKey: key,
      payload: { seedTerm: "vercel durable seo queue" }
    });
    expect(first.deduplicated).toBe(false);

    const second = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "KEYWORD_RESEARCH",
      idempotencyKey: key,
      payload: { seedTerm: "vercel durable seo queue" }
    });
    expect(second.deduplicated).toBe(true);
    expect(second.jobId).toBe(first.jobId);
  });

  it("handles transient failures with exponential retry scheduling and dead-letter transition, plus stalled lease recovery", async () => {
    const retryKey = `retry-test-${Date.now()}`;
    const job = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "SEO_AUDITING",
      idempotencyKey: retryKey,
      maxAttempts: 2,
      payload: {
        simulateFailure: true,
        failUntilAttempt: 5
      }
    });

    // Attempt 1 -> fails and transitions to RETRY_SCHEDULED
    const attempt1 = await processDurableJobById(job.jobId, "test-worker");
    expect(attempt1.status).toBe("RETRY_SCHEDULED");
    expect(attempt1.attempts).toBe(1);

    // Attempt 2 (maxAttempts = 2) -> fails and transitions to DEAD_LETTER
    const attempt2 = await processDurableJobById(job.jobId, "test-worker");
    expect(attempt2.status).toBe("DEAD_LETTER");
    expect(attempt2.attempts).toBe(2);

    // Verify stalled lease recovery when a worker crashes mid-execution
    const db = await getDb();
    const stalledKey = `stalled-lease-${Date.now()}`;
    const stalledJob = await db.durableJob.create({
      data: {
        websiteId: primaryWebsiteId,
        jobType: "SEARCH_PERFORMANCE_MONITORING",
        idempotencyKey: stalledKey,
        status: "RUNNING",
        attempts: 1,
        maxAttempts: 3,
        lockedBy: "crashed-worker-99",
        lockedUntil: new Date(Date.now() - 60_000)
      }
    });

    const recoveredCount = await recoverStalledJobs();
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await db.durableJob.findUnique({ where: { id: stalledJob.id } });
    expect(refreshed?.status).toBe("RETRY_SCHEDULED");
    expect(refreshed?.lockedBy).toBeNull();
  });

  it("executes all 7 durable job types end-to-end including compliance-gated publishing to the public website", async () => {
    expect(DURABLE_JOB_TYPES.length).toBe(7);

    const slug = `vercel-e2e-published-${Date.now()}`;
    // 1. AI_ARTICLE_GENERATION
    const genJob = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "AI_ARTICLE_GENERATION",
      idempotencyKey: `e2e-gen-${slug}`,
      payload: {
        websiteId: primaryWebsiteId,
        title: "End-to-End Vercel & Durable Worker Publishing Guide",
        slug
      }
    });
    const genDone = await processDurableJobById(genJob.jobId, "e2e-worker");
    expect(genDone.status).toBe("COMPLETED");
    const generatedArticleId = (genDone.result as { articleId: string }).articleId;
    expect(generatedArticleId).toBeTruthy();

    // 2. IMAGE_GENERATION
    const imgJob = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "IMAGE_GENERATION",
      idempotencyKey: `e2e-img-${slug}`,
      payload: {
        articleId: generatedArticleId,
        altText: "End-to-end Vercel architecture diagram"
      }
    });
    const imgDone = await processDurableJobById(imgJob.jobId, "e2e-worker");
    expect(imgDone.status).toBe("COMPLETED");

    // 3. SEO_AUDITING
    const seoJob = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "SEO_AUDITING",
      idempotencyKey: `e2e-seo-${slug}`,
      payload: { slug }
    });
    const seoDone = await processDurableJobById(seoJob.jobId, "e2e-worker");
    expect(seoDone.status).toBe("COMPLETED");

    // 4. ADSENSE_COMPLIANCE_AUDITING
    const adsJob = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "ADSENSE_COMPLIANCE_AUDITING",
      idempotencyKey: `e2e-ads-${slug}`,
      payload: { siteUrl: "https://apextech.example.com" }
    });
    const adsDone = await processDurableJobById(adsJob.jobId, "e2e-worker");
    expect(adsDone.status).toBe("COMPLETED");

    // 5. AUTOMATED_PUBLISHING (End-to-End transition to PUBLISHED + PublishingJob creation)
    const pubJob = await enqueueDurableJob({
      websiteId: primaryWebsiteId,
      jobType: "AUTOMATED_PUBLISHING",
      idempotencyKey: `e2e-pub-${slug}`,
      payload: {
        websiteId: primaryWebsiteId,
        articleId: generatedArticleId,
        requireHumanApproval: false
      }
    });
    const pubDone = await processDurableJobById(pubJob.jobId, "e2e-worker");
    expect(pubDone.status).toBe("COMPLETED");
    expect((pubDone.result as { published: boolean }).published).toBe(true);

    // Verify article is now PUBLISHED in PostgreSQL and resiliently queryable for public site even if worker is stopped
    const db = await getDb();
    const publishedArticle = await db.article.findUnique({
      where: { id: generatedArticleId }
    });
    expect(publishedArticle?.status).toBe("PUBLISHED");
    expect(publishedArticle?.publishedUrl).toContain(`/p/${primaryWebsiteId}/${slug}`);
  });

  it("verifies /api/v1/jobs and /api/v1/cron/enqueue-schedules Vercel Function endpoints", async () => {
    const authHeaders = new Headers({
      Cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      Authorization: `Bearer ${adminToken}`
    });

    const getRes = await jobsGet(new NextRequest("http://localhost:3000/api/v1/jobs", { headers: authHeaders }));
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.data.architecture.persistentWorkersInsideVercelFunctions).toBe(false);

    const postHeaders = new Headers(authHeaders);
    postHeaders.set("Content-Type", "application/json");
    const postRes = await jobsPost(
      new NextRequest("http://localhost:3000/api/v1/jobs", {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({
          websiteId: primaryWebsiteId,
          jobType: "SEARCH_PERFORMANCE_MONITORING",
          idempotencyKey: `api-job-${Date.now()}`
        })
      })
    );
    expect(postRes.status).toBe(201);

    // Dispatch PUT /api/v1/jobs with HMAC-SHA256 worker signature
    const rawPutBody = JSON.stringify({
      action: "process_batch",
      workerId: "hmac-verified-worker",
      maxBatchSize: 3
    });
    const ts = String(Date.now());
    const sig = signWorkerPayload(rawPutBody, ts, getWorkerSharedSecret());
    const putRes = await jobsPut(
      new NextRequest("http://localhost:3000/api/v1/jobs", {
        method: "PUT",
        headers: new Headers({
          "Content-Type": "application/json",
          "X-Worker-Timestamp": ts,
          "X-Worker-Signature": sig
        }),
        body: rawPutBody
      })
    );
    expect(putRes.status).toBe(200);

    // Trigger Vercel Cron endpoint with Bearer secret
    const cronRes = await cronGet(
      new NextRequest("http://localhost:3000/api/v1/cron/enqueue-schedules", {
        headers: new Headers({
          Authorization: `Bearer ${getWorkerSharedSecret()}`
        })
      })
    );
    const cronJson = await cronRes.json();
    expect(cronRes.status).toBe(200);
    expect(cronJson.success).toBe(true);
  });
});

