import { describe, it, expect, vi } from "vitest";
import { GET as healthHandler } from "../src/app/api/v1/health/route";
import { POST as changePasswordHandler } from "../src/app/api/v1/auth/change-password/route";
import { GET as complianceHandler } from "../src/app/api/v1/compliance/route";
import { POST as topicOutlineHandler } from "../src/app/api/v1/content/topic-outline/route";
import { ensureSystemSeeded } from "../src/lib/seed-service";
import { NextRequest } from "next/server";
import * as apiRespLib from "../src/lib/api-response";

describe("Phase N — Core Consumer Decoupling & MongoDB Readiness Tests", () => {
  describe("1. Seed Service Idempotency", () => {
    it("runs ensureSystemSeeded multiple times idempotently without throwing", async () => {
      await expect(ensureSystemSeeded()).resolves.not.toThrow();
      await expect(ensureSystemSeeded()).resolves.not.toThrow();
    });
  });

  describe("2. Health Endpoint", () => {
    it("returns database health and valid metrics structure", async () => {
      const res = await healthHandler();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("healthy");
      expect(body.data.metrics).toBeDefined();
      expect(typeof body.data.metrics.users).toBe("number");
      expect(typeof body.data.metrics.websites).toBe("number");
    });
  });

  describe("3. Change Password Authorization & Validation", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "Password@123",
          newPassword: "NewPassword@1234",
          confirmPassword: "NewPassword@1234"
        })
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(401);
    });

    it("validates password schema and rejects non-matching confirmation", async () => {
      vi.spyOn(apiRespLib, "requireApiAuth").mockResolvedValueOnce({
        user: {
          id: "user-test-1",
          email: "test@example.com",
          name: "Test User",
          roleName: "SUPER_ADMIN",
          permissions: ["*"],
          tokenVersion: 0,
          mustChangePassword: false
        },
        errorResponse: null
      } as any);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "OldPassword@123",
          newPassword: "NewPassword@123",
          confirmPassword: "DifferentPassword@123"
        })
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("4. Compliance Route Authorization & Isolation", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/compliance?websiteId=non-existent-site", {
        method: "GET"
      });

      const res = await complianceHandler(req);
      expect(res.status).toBe(401);
    });
  });

  describe("5. Topic Outline Authorization", () => {
    it("rejects unauthenticated topic outline requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/content/topic-outline", {
        method: "POST",
        body: JSON.stringify({
          stage: "validate_outline",
          input: {
            websiteId: "site-123",
            pillarTopic: "SEO Automation",
            subtopic: "Ollama Integration",
            targetAudience: "Developers",
            targetKeyword: "ollama seo"
          },
          outline: {
            h1: "Ollama SEO",
            sections: []
          }
        })
      });

      const res = await topicOutlineHandler(req);
      expect(res.status).toBe(401);
    });
  });
});
