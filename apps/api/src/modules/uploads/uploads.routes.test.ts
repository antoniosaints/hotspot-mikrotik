import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  admin: {
    findUnique: vi.fn(),
  },
  $disconnect: vi.fn(),
}));

// PNG 1x1 transparente.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("uploads routes", () => {
  let uploadsDir: string;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    uploadsDir = mkdtempSync(path.join(tmpdir(), "hotspot-uploads-"));
    process.env.UPLOADS_DIR = uploadsDir;

    vi.doMock("../../db.js", () => ({
      prisma: prismaMock,
    }));

    prismaMock.admin.findUnique.mockResolvedValue({ ativo: true, role: "admin" });
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  async function buildApp() {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();
    await app.ready();
    const token = app.jwt.sign({ id: "admin-1", usuario: "admin", role: "admin" });
    return { app, token };
  }

  it("uploads, lists, serves publicly and deletes an image", async () => {
    const { app, token } = await buildApp();

    try {
      const uploadResponse = await app.inject({
        method: "POST",
        url: "/api/uploads",
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: "Logo Café.PNG", dataBase64: `data:image/png;base64,${PNG_BASE64}` },
      });
      expect(uploadResponse.statusCode).toBe(201);
      const uploaded = uploadResponse.json() as { name: string; url: string };
      expect(uploaded.name).toMatch(/logo-cafe\.png$/);
      expect(uploaded.url).toContain(`/api/uploads/file/${uploaded.name}`);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/uploads",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toHaveLength(1);

      // Servico publico: portal do cliente acessa sem token.
      const fileResponse = await app.inject({ method: "GET", url: `/api/uploads/file/${uploaded.name}` });
      expect(fileResponse.statusCode).toBe(200);
      expect(fileResponse.headers["content-type"]).toContain("image/png");

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/uploads/${uploaded.name}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteResponse.statusCode).toBe(200);

      const afterDelete = await app.inject({ method: "GET", url: `/api/uploads/file/${uploaded.name}` });
      expect(afterDelete.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("rejects unsupported extensions and unauthenticated access", async () => {
    const { app, token } = await buildApp();

    try {
      const badExtension = await app.inject({
        method: "POST",
        url: "/api/uploads",
        headers: { authorization: `Bearer ${token}` },
        payload: { nome: "script.svg", dataBase64: PNG_BASE64 },
      });
      expect(badExtension.statusCode).toBe(400);

      const unauthenticated = await app.inject({ method: "GET", url: "/api/uploads" });
      expect(unauthenticated.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("blocks path traversal on file serving", async () => {
    const { app } = await buildApp();

    try {
      const response = await app.inject({ method: "GET", url: "/api/uploads/file/..%2F..%2Fpackage.json" });
      expect([400, 404]).toContain(response.statusCode);
    } finally {
      await app.close();
    }
  });
});
