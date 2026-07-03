import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("buildServer", () => {
  it("responds to health and protects dashboard", async () => {
    const app = buildServer();

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ ok: true });

      const dashboard = await app.inject({ method: "GET", url: "/api/dashboard" });
      expect(dashboard.statusCode).toBe(401);
      expect(dashboard.json()).toEqual({ error: "Token invalido ou ausente." });
    } finally {
      await app.close();
    }
  });
});
