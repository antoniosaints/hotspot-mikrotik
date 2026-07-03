import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];

const voucherUpdateMany = vi.fn(async () => {
  calls.push("voucher.updateMany");
  return { count: 1 };
});

const voucherCompensate = vi.fn(async () => {
  calls.push("voucher.compensate");
  return { count: 1 };
});

const acessoCreate = vi.fn(async () => {
  calls.push("acesso.create");
  return {};
});

const prismaMock = vi.hoisted(() => ({
  hotspot: {
    findUnique: vi.fn(),
  },
  voucher: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  cpfLogin: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
  $disconnect: vi.fn(),
}));

const createHotspotUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../db.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../services/mikrotik.service.js", () => ({
  createHotspotUser: createHotspotUserMock,
  disconnectActiveHotspotClient: vi.fn(),
  listActiveHotspotClients: vi.fn(async () => []),
  listHotspotUsers: vi.fn(async () => []),
  removeHotspotUser: vi.fn(),
  removeHotspotUserById: vi.fn(),
  testConnection: vi.fn(async () => ({ ok: true })),
}));

describe("portal voucher login", () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    vi.clearAllMocks();

    prismaMock.hotspot.findUnique.mockResolvedValue({
      id: "hotspot-1",
      slug: "padrao",
      ativo: true,
      loginVoucher: true,
      loginCpf: false,
      mikrotikId: "mikrotik-1",
      mikrotik: {
        id: "mikrotik-1",
        ativo: true,
        profilePadrao: "default",
      },
    });

    prismaMock.voucher.findFirst.mockResolvedValue({
      id: "voucher-1",
      codigo: "ABC123",
      tempoMinutos: 30,
    });

    prismaMock.voucher.updateMany.mockImplementation(voucherCompensate);
    createHotspotUserMock.mockImplementation(async () => {
      calls.push("createHotspotUser");
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        voucher: { updateMany: voucherUpdateMany },
        cpfLogin: { update: vi.fn() },
        acesso: { create: acessoCreate },
      }),
    );
  });

  it("reserves the voucher before creating the MikroTik user", async () => {
    const { buildServer } = await import("../../server.js");
    const app = buildServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/portal/login",
        payload: {
          loginType: "voucher",
          hotspotSlug: "padrao",
          voucher: "ABC123",
          mac: "AA:BB",
          ip: "10.0.0.2",
          linkLoginOnly: "http://10.0.0.1/login",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(calls).toContain("voucher.updateMany");
      expect(calls).toContain("createHotspotUser");
      expect(calls.indexOf("voucher.updateMany")).toBeLessThan(calls.indexOf("createHotspotUser"));
      expect(acessoCreate).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it("releases the local voucher reservation when MikroTik creation fails", async () => {
    createHotspotUserMock.mockImplementationOnce(async () => {
      calls.push("createHotspotUser");
      throw new Error("mikrotik offline");
    });

    const { buildServer } = await import("../../server.js");
    const app = buildServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/portal/login",
        payload: {
          loginType: "voucher",
          hotspotSlug: "padrao",
          voucher: "ABC123",
          mac: "AA:BB",
          ip: "10.0.0.2",
          linkLoginOnly: "http://10.0.0.1/login",
        },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({ error: "mikrotik offline" });
      expect(voucherCompensate).toHaveBeenCalledWith({
        where: { id: "voucher-1", usado: true },
        data: { usado: false, mac: null, ip: null, usadoEm: null },
      });
      expect(acessoCreate).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
