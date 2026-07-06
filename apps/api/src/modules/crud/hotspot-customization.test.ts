import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  admin: {
    findUnique: vi.fn(),
  },
  hotspot: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  local: {},
  mikrotik: {},
  integracao: {},
  voucher: {},
  cadastroTela: {},
  cpfLogin: {},
  planoBilheteria: {},
  compraAcesso: {},
  leadContratacao: {},
  $disconnect: vi.fn(),
}));

describe("hotspot portal customization CRUD", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("../../db.js", () => ({
      prisma: prismaMock,
    }));

    vi.doMock("@prisma/client", () => ({
      Prisma: {
        PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
          code: string;

          constructor(message: string, options: { code: string }) {
            super(message);
            this.code = options.code;
          }
        },
      },
    }));

    prismaMock.admin.findUnique.mockResolvedValue({ ativo: true, role: "admin" });
    prismaMock.hotspot.create.mockImplementation(async ({ data }) => ({ id: "hotspot-1", ...data }));
  });

  it("persists portal identity and color fields when creating a hotspot", async () => {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();
    await app.ready();
    const token = app.jwt.sign({ id: "admin-1", usuario: "admin", role: "admin" });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/hotspots",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nome: "Unidade Centro",
          slug: "centro",
          portalUrl: "http://localhost:5173/portal/centro",
          localId: "local-1",
          mikrotikId: "mikrotik-1",
          portalLogoUrl: "https://cdn.example.com/logo.png",
          portalTitulo: "Wi-Fi Centro",
          portalSubtitulo: "Conecte-se com segurança",
          portalRodape: "Prefeitura - Internet publica",
          portalCorFundo: "#003b73",
          portalCorFundoFim: "#00a8e8",
          portalCorTexto: "#ffffff",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.hotspot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          portalLogoUrl: "https://cdn.example.com/logo.png",
          portalTitulo: "Wi-Fi Centro",
          portalSubtitulo: "Conecte-se com segurança",
          portalRodape: "Prefeitura - Internet publica",
          portalCorFundo: "#003b73",
          portalCorFundoFim: "#00a8e8",
          portalCorTexto: "#ffffff",
        }),
      });
    } finally {
      await app.close();
    }
  });
});
