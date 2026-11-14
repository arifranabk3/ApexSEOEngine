import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/v1/finance/pakistan-gold-rates/route";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken } from "@/lib/auth";

describe("Phase 02.2: Pakistan Gold Rates API Route (/api/v1/finance/pakistan-gold-rates)", () => {
  let adminToken: string;

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
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/finance/pakistan-gold-rates?city=islamabad");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("rejects unsupported city slugs with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/finance/pakistan-gold-rates?city=london", {
      headers: { Cookie: `apexseo_session=${adminToken}` }
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CITY");
  });

  it("returns normalized gold rates for supported cities without exposing secrets", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/finance/pakistan-gold-rates?city=islamabad", {
      headers: { Cookie: `apexseo_session=${adminToken}` }
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.rates.citySlug).toBe("islamabad");
    expect(body.data.rates.currency).toBe("PKR");
    expect(body.data.rates.rates["24K"]).toBeDefined();
    expect(body.data.rates.rates["22K"]).toBeDefined();
    expect(body.data.rates.rates["21K"]).toBeDefined();
    expect(body.data.rates.rates["18K"]).toBeDefined();
    expect(body.data.rates.disclaimer).toContain("Sarafa.pk");

    // Ensure no API keys or credentials leaked in response body
    const stringified = JSON.stringify(body);
    expect(stringified).not.toContain("SARAFA_API_KEY");
    expect(stringified).not.toContain("secret");
  });
});
