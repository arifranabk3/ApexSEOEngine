import { describe, it, expect } from "vitest";
import { pingMongo, getMongoDb } from "@/lib/mongodb";

describe("MongoDB Atlas Live Connectivity Verification", () => {
  it("successfully connects to MongoDB Atlas and executes ping command", async () => {
    const health = await pingMongo();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThan(0);
    expect(health.databaseName).toBeTruthy();
    // eslint-disable-next-line no-console
    console.log(`[MongoDB Verified] Connected to '${health.databaseName}' in ${health.latencyMs}ms`);
  });

  it("can list collections from the connected database", async () => {
    const db = await getMongoDb();
    const collections = await db.listCollections().toArray();
    expect(Array.isArray(collections)).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`[Collections Found]:`, collections.map((c) => c.name));
  });
});
