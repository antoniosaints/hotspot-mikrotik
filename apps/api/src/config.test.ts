import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalWebOrigin = process.env.WEB_ORIGIN;
  const originalWebOrigins = process.env.WEB_ORIGINS;

  afterEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (originalWebOrigin === undefined) {
      delete process.env.WEB_ORIGIN;
    } else {
      process.env.WEB_ORIGIN = originalWebOrigin;
    }
    if (originalWebOrigins === undefined) {
      delete process.env.WEB_ORIGINS;
    } else {
      process.env.WEB_ORIGINS = originalWebOrigins;
    }
  });

  it("rejects missing JWT_SECRET in production", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    await expect(import("./config.js")).rejects.toThrow("JWT_SECRET forte e obrigatorio em producao.");
  });

  it("keeps development fallback JWT secret", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "development";
    delete process.env.JWT_SECRET;

    await expect(import("./config.js")).resolves.toMatchObject({
      config: expect.objectContaining({ jwtSecret: "dev-hotspot-secret" }),
    });
  });

  it("reads multiple allowed web origins", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "development";
    process.env.WEB_ORIGINS = "https://hotspot.cas.net.br, https://cas-hotspot.nogezu.easypanel.host";

    await expect(import("./config.js")).resolves.toMatchObject({
      config: expect.objectContaining({
        webOrigins: ["https://hotspot.cas.net.br", "https://cas-hotspot.nogezu.easypanel.host"],
      }),
    });
  });
});
