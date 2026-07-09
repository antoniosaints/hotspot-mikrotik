import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const delegate = () => ({
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
  });

  return {
    admin: delegate(),
    local: delegate(),
    mikrotik: delegate(),
    integracao: delegate(),
    hotspot: delegate(),
    voucher: delegate(),
    cadastroTela: delegate(),
    cpfLogin: delegate(),
    plano: delegate(),
    campanha: delegate(),
    compraAcesso: delegate(),
    leadContratacao: delegate(),
    dispositivo: delegate(),
    consentimentoLgpd: delegate(),
    configuracao: delegate(),
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
});

describe("usuarios CRUD safety", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("../../db.js", () => ({ prisma: prismaMock }));
    prismaMock.admin.findUnique.mockResolvedValue({ ativo: true, role: "admin" });
    prismaMock.admin.findMany.mockResolvedValue([]);
    prismaMock.admin.count.mockResolvedValue(0);
  });

  async function buildApp() {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();
    await app.ready();
    const token = app.jwt.sign({ id: "admin-1", usuario: "admin", role: "admin" });
    return { app, token };
  }

  it("blocks an admin from changing their own role", async () => {
    const { app, token } = await buildApp();

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/api/usuarios/admin-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { role: "manager" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("propria permissao");
      expect(prismaMock.admin.update).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("blocks deleting the current admin user", async () => {
    const { app, token } = await buildApp();

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/usuarios/admin-1",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("proprio usuario");
      expect(prismaMock.admin.delete).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("blocks demoting the last active admin", async () => {
    const { app, token } = await buildApp();

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/api/usuarios/admin-2",
        headers: { authorization: `Bearer ${token}` },
        payload: { role: "manager" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain("ultimo administrador ativo");
      expect(prismaMock.admin.update).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
