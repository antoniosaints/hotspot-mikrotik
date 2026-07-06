import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  compraAcesso: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  acesso: {
    update: vi.fn(),
  },
}));

const listActiveMock = vi.hoisted(() => vi.fn());
const disconnectMock = vi.hoisted(() => vi.fn());
const removeUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../db.js", () => ({ prisma: prismaMock }));
vi.mock("../../services/mikrotik.service.js", () => ({
  listActiveHotspotClients: listActiveMock,
  disconnectActiveHotspotClient: disconnectMock,
  removeHotspotUser: removeUserMock,
}));

import { runExpirationSweep } from "./expiration.service.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mikrotik = {
  ativo: true,
  host: "10.0.0.1",
  usuarioApi: "api",
  senhaApi: "x",
  portaApi: 8728,
  timeoutApi: 5000,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.compraAcesso.update.mockResolvedValue({});
  prismaMock.acesso.update.mockResolvedValue({});
  listActiveMock.mockResolvedValue([]);
  disconnectMock.mockResolvedValue(undefined);
  removeUserMock.mockResolvedValue(undefined);
});

describe("runExpirationSweep", () => {
  it("expires pending purchases past the payment window and revokes router access", async () => {
    prismaMock.compraAcesso.findMany
      .mockResolvedValueOnce([
        { id: "c1", loginUsuario: "T123", acessoId: null, hotspot: { mikrotik } },
      ])
      .mockResolvedValueOnce([]);
    listActiveMock.mockResolvedValue([
      { id: "*1", username: "T123" },
      { id: "*2", username: "outro" },
    ]);

    await runExpirationSweep(log);

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalledWith(mikrotik, "*1");
    expect(removeUserMock).toHaveBeenCalledWith(mikrotik, "T123");
    expect(prismaMock.compraAcesso.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "EXPIRADA", erroLiberacao: "Janela de pagamento expirada sem confirmacao." },
    });
  });

  it("ends released purchases whose paid time ran out and expires the access record", async () => {
    prismaMock.compraAcesso.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "c2", loginUsuario: "T999", acessoId: "a1", hotspot: { mikrotik } },
      ]);

    await runExpirationSweep(log);

    expect(removeUserMock).toHaveBeenCalledWith(mikrotik, "T999");
    expect(prismaMock.compraAcesso.update).toHaveBeenCalledWith({
      where: { id: "c2" },
      data: { status: "ENCERRADA" },
    });
    expect(prismaMock.acesso.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { status: "EXPIRADO" },
    });
  });

  it("skips router calls when the MikroTik is inactive", async () => {
    prismaMock.compraAcesso.findMany
      .mockResolvedValueOnce([
        { id: "c3", loginUsuario: "T555", acessoId: null, hotspot: { mikrotik: { ...mikrotik, ativo: false } } },
      ])
      .mockResolvedValueOnce([]);

    await runExpirationSweep(log);

    expect(listActiveMock).not.toHaveBeenCalled();
    expect(removeUserMock).not.toHaveBeenCalled();
    expect(prismaMock.compraAcesso.update).toHaveBeenCalledWith({
      where: { id: "c3" },
      data: { status: "EXPIRADA", erroLiberacao: "Janela de pagamento expirada sem confirmacao." },
    });
  });

  it("keeps processing when one purchase fails", async () => {
    prismaMock.compraAcesso.findMany
      .mockResolvedValueOnce([
        { id: "bad", loginUsuario: "TBAD", acessoId: null, hotspot: { mikrotik } },
        { id: "ok", loginUsuario: "TOK", acessoId: null, hotspot: { mikrotik: { ...mikrotik, ativo: false } } },
      ])
      .mockResolvedValueOnce([]);
    removeUserMock.mockRejectedValueOnce(new Error("router offline"));

    await runExpirationSweep(log);

    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(prismaMock.compraAcesso.update).toHaveBeenCalledWith({
      where: { id: "ok" },
      data: { status: "EXPIRADA", erroLiberacao: "Janela de pagamento expirada sem confirmacao." },
    });
  });
});
