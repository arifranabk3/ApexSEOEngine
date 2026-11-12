/**
 * STANDALONE AUTOMATION WORKER SERVICE (DECOUPLED FROM VERCEL FUNCTIONS)
 *
 * This service is independently deployable on any container/VPS host (Railway, Render,
 * Fly.io, Cloud Run, or Docker Compose alongside n8n Community Edition).
 *
 * Strictly enforces the Vercel-First requirement:
 * - Never runs persistent loops inside Vercel Serverless Functions.
 * - Communicates with the Vercel API via HMAC-SHA256 signed requests OR directly
 *   polls the external managed PostgreSQL `DurableJob` queue with lease recovery.
 */

import http from "http";
import {
  processDurableJobBatch,
  recoverStalledJobs,
  signWorkerPayload,
  getWorkerSharedSecret
} from "../../src/services/automation/durable-job-queue";
import { runSchedulerTick } from "../../src/services/automation/job-scheduler";

const WORKER_ID = process.env.WORKER_ID || `standalone-automation-worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 10_000);
const WORKER_PORT = Number(process.env.WORKER_PORT || 4100);
const VERCEL_API_URL = process.env.VERCEL_API_URL || "";

let isRunningCycle = false;
let totalProcessedJobs = 0;
let lastCycleAt: string | null = null;

export async function runSingleWorkerCycle() {
  if (isRunningCycle) return { skipped: true };
  isRunningCycle = true;

  try {
    await recoverStalledJobs();

    // If configured to dispatch over HTTP to Vercel API using HMAC-SHA256 signature:
    if (VERCEL_API_URL && process.env.WORKER_MODE === "REMOTE_HTTP") {
      const body = JSON.stringify({
        action: "process_batch",
        workerId: WORKER_ID,
        maxBatchSize: 5
      });
      const ts = String(Date.now());
      const sig = signWorkerPayload(body, ts, getWorkerSharedSecret());

      const res = await fetch(`${VERCEL_API_URL.replace(/\/$/, "")}/api/v1/jobs`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Timestamp": ts,
          "X-Worker-Signature": sig
        },
        body
      });
      const json = await res.json();
      lastCycleAt = new Date().toISOString();
      return json;
    }

    // Direct durable PostgreSQL queue processing
    const batchResult = await processDurableJobBatch({
      workerId: WORKER_ID,
      maxBatchSize: 5
    });
    totalProcessedJobs += batchResult.processedCount;
    lastCycleAt = new Date().toISOString();
    return batchResult;
  } finally {
    isRunningCycle = false;
  }
}

export function startStandaloneWorkerDaemon() {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          service: "standalone-automation-worker",
          workerId: WORKER_ID,
          totalProcessedJobs,
          lastCycleAt
        })
      );
      return;
    }

    if (req.url === "/trigger" && req.method === "POST") {
      const result = await runSingleWorkerCycle();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: result }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  server.listen(WORKER_PORT, () => {
    console.log(
      `[AutomationWorker] Standalone service (${WORKER_ID}) listening on port ${WORKER_PORT}`
    );
  });

  const interval = setInterval(() => {
    runSingleWorkerCycle().catch((err) => {
      console.error("[AutomationWorker] Cycle error:", err);
    });
  }, POLL_INTERVAL_MS);

  // Built-in self-hosted scheduler (replaces sub-daily Vercel Cron). Disable with
  // SCHEDULER_INTERVAL_MS=0 when GitHub Actions / cron-job.org drives the tick instead.
  const schedulerIntervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000);
  const schedulerTimer =
    schedulerIntervalMs > 0
      ? setInterval(() => {
          runSchedulerTick({ triggeredBy: `worker:${WORKER_ID}` }).catch((err) => {
            console.error("[AutomationWorker] Scheduler tick error:", err);
          });
        }, schedulerIntervalMs)
      : null;

  return {
    server,
    stop: () => {
      clearInterval(interval);
      if (schedulerTimer) clearInterval(schedulerTimer);
      server.close();
    }
  };
}

if (require.main === module) {
  startStandaloneWorkerDaemon();
}

