import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  admin: { findUnique: vi.fn() },
  configuracao: { upsert: vi.fn(), update: vi.fn() },
  hotspot: { findUnique: vi.fn() },
  consentimentoLgpd: { create: vi.fn(), findMany: vi.fn() },
  $disconnect: vi.fn(),
}));

const defaultConfig = {
  id: "global",
  termosUso: "",
  politicaPrivacidade: "",
  lgpdConsentimentoTexto: "Li e concordo.",
  lgpdVersao: "1",
  exigirConsentimento: true,
  encarregadoNome: null,
  encarregadoEmail: null,
  empresaNome: null,
  empresaDocumento: null,
};

describe("settings e consentimento LGPD", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("../../db.js", () => ({ prisma: prismaMock }));

    prismaMock.admin.findUnique.mockResolvedValue({ ativo: true, role: "admin" });
    prismaMock.configuracao.upsert.mockResolvedValue(defaultConfig);
    prismaMock.configuracao.update.mockImplementation(async ({ data }) => ({ ...defaultConfig, ...data }));
  });

  async function buildApp() {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();
    await app.ready();
    const token = app.jwt.sign({ id: "admin-1", usuario: "admin", role: "admin" });
    return { app, token };
  }

  it("GET /config retorna o singleton (upsert cria se ausente)", async () => {
    const { app, token } = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/config",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe("global");
      expect(prismaMock.configuracao.upsert).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("PUT /config atualiza os textos", async () => {
    const { app, token } = await buildApp();
    try {
      const response = await app.inject({
        method: "PUT",
        url: "/api/config",
        headers: { authorization: `Bearer ${token}` },
        payload: { termosUso: "Novos termos", exigirConsentimento: false, lgpdVersao: "2" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().termosUso).toBe("Novos termos");
      expect(prismaMock.configuracao.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "global" } }),
      );
    } finally {
      await app.close();
    }
  });

  it("POST /portal/consentimento grava IP/User-Agent/versao (sem auth)", async () => {
    prismaMock.hotspot.findUnique.mockResolvedValue({ id: "hotspot-1" });
    prismaMock.consentimentoLgpd.create.mockResolvedValue({ id: "consent-1" });

    const { app } = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/portal/consentimento",
        headers: { "user-agent": "vitest-agent" },
        payload: { hotspotSlug: "padrao", versaoTermos: "1", mac: "AA:BB" },
      });
      expect(response.statusCode).toBe(200);

      const call = prismaMock.consentimentoLgpd.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        hotspotId: "hotspot-1",
        versaoTermos: "1",
        mac: "AA:BB",
        userAgent: "vitest-agent",
      });
      expect(typeof call.data.ip).toBe("string");
    } finally {
      await app.close();
    }
  });

  it("POST /portal/consentimento retorna 404 para hotspot inexistente", async () => {
    prismaMock.hotspot.findUnique.mockResolvedValue(null);

    const { app } = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/portal/consentimento",
        payload: { hotspotSlug: "nao-existe", versaoTermos: "1" },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
