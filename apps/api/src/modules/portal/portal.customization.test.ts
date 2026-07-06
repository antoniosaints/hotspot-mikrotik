import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  hotspot: {
    findUnique: vi.fn(),
  },
  $disconnect: vi.fn(),
}));

describe("portal customization payload", () => {
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

    prismaMock.hotspot.findUnique.mockResolvedValue({
      id: "hotspot-1",
      nome: "Unidade Centro",
      slug: "centro",
      portalUrl: "http://localhost:5173/portal/centro",
      portalLogoUrl: "https://cdn.example.com/logo.png",
      portalTitulo: "Wi-Fi Centro",
      portalSubtitulo: "Conecte-se com segurança",
      portalRodape: "Prefeitura - Internet publica",
      portalCorFundo: "#003b73",
      portalCorFundoFim: "#00a8e8",
      portalCorTexto: "#ffffff",
      loginVoucher: true,
      loginCpf: true,
      loginIntegracao: false,
      compraOnline: false,
      compraPersonalizada: false,
      valorMinutoCentavos: null,
      tempoPersonalizadoMinimo: 10,
      tempoPersonalizadoMaximo: 240,
      tempoPersonalizadoPasso: 10,
      conexoesPersonalizado: 1,
      ativo: true,
      local: { id: "local-1", nome: "Centro" },
      integracao: null,
      pagamentoIntegracao: null,
      cadastroTela: null,
      planos: [],
    });
  });

  it("selects and returns hotspot portal identity fields", async () => {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/portal/centro",
      });

      expect(response.statusCode).toBe(200);
      expect(prismaMock.hotspot.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            portalLogoUrl: true,
            portalTitulo: true,
            portalSubtitulo: true,
            portalRodape: true,
            portalCorFundo: true,
            portalCorFundoFim: true,
            portalCorTexto: true,
          }),
        }),
      );
      expect(response.json().hotspot).toMatchObject({
        portalLogoUrl: "https://cdn.example.com/logo.png",
        portalTitulo: "Wi-Fi Centro",
        portalSubtitulo: "Conecte-se com segurança",
        portalRodape: "Prefeitura - Internet publica",
        portalCorFundo: "#003b73",
        portalCorFundoFim: "#00a8e8",
        portalCorTexto: "#ffffff",
      });
    } finally {
      await app.close();
    }
  });
});
