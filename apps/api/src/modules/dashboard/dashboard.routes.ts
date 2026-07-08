import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { disconnectActiveHotspotClient, listActiveHotspotClients, removeHotspotUser } from "../../services/mikrotik.service.js";
import { AccessStatus, LoginType } from "../../types.js";
import { sendCrudError, sendZodError } from "../../utils/http.js";
import { AdminRole, requireAnyRole } from "../auth/permissions.js";

const dashboardQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  localId: z.string().optional(),
  hotspotId: z.string().optional(),
});

const disconnectParamsSchema = z.object({
  mikrotikId: z.string().min(1),
});

const disconnectBodySchema = z.object({
  activeId: z.string().min(1),
  username: z.string().optional(),
  removeUser: z.boolean().optional(),
});

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function parseDate(value: string | undefined, fallback: Date, end = false) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return end ? endOfDay(date) : startOfDay(date);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function increment(map: Map<string, { id: string; nome: string; total: number }>, id: string, nome: string) {
  const current = map.get(id) ?? { id, nome, total: 0 };
  current.total += 1;
  map.set(id, current);
}

async function cleanupExpiredHotspotUsers() {
  const expiredAccesses = await prisma.acesso.findMany({
    where: {
      status: AccessStatus.LIBERADO,
      expiraEm: { lte: new Date() },
      mikrotikId: { not: null },
    },
    include: { mikrotik: true },
    take: 50,
  });

  for (const acesso of expiredAccesses) {
    try {
      if (acesso.mikrotik?.ativo) {
        await removeHotspotUser(acesso.mikrotik, acesso.codigo);
      }
      await prisma.acesso.update({
        where: { id: acesso.id },
        data: { status: AccessStatus.EXPIRADO },
      });
    } catch {
      // Mantem LIBERADO para tentar novamente na proxima consulta do dashboard.
    }
  }
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", { preHandler: app.authenticate }, async (request, reply) => {
    try {
      await cleanupExpiredHotspotUsers();
      const query = dashboardQuerySchema.parse(request.query);
      const today = startOfDay(new Date());
      const defaultFrom = new Date(today);
      defaultFrom.setDate(defaultFrom.getDate() - 6);

      const from = parseDate(query.from, defaultFrom);
      const to = parseDate(query.to, endOfDay(today), true);
      const hotspotWhere = {
        ...(query.localId ? { localId: query.localId } : {}),
        ...(query.hotspotId ? { id: query.hotspotId } : {}),
      };
      const acessoWhere = {
        loginEm: { gte: from, lte: to },
        ...(query.hotspotId || query.localId ? { hotspot: hotspotWhere } : {}),
      };
      const voucherWhere = query.hotspotId || query.localId ? { hotspot: hotspotWhere } : {};

      const [
        vouchersTotal,
        vouchersUsados,
        hotspots,
        mikrotiks,
        acessos,
        accessRows,
        recentAccesses,
        locais,
        hotspotsList,
        activeMikrotiks,
      ] = await Promise.all([
        prisma.voucher.count({ where: voucherWhere }),
        prisma.voucher.count({ where: { ...voucherWhere, usado: true } }),
        prisma.hotspot.count({ where: hotspotWhere }),
        prisma.mikrotik.count(),
        prisma.acesso.count({ where: acessoWhere }),
        prisma.acesso.findMany({
          where: acessoWhere,
          select: {
            loginEm: true,
            tipo: true,
            hotspot: { select: { id: true, nome: true, local: { select: { id: true, nome: true } } } },
          },
        }),
        prisma.acesso.findMany({
          where: acessoWhere,
          take: 10,
          orderBy: { loginEm: "desc" },
          include: { hotspot: true, voucher: true, cpfLogin: true },
        }),
        prisma.local.findMany({ orderBy: { nome: "asc" } }),
        prisma.hotspot.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, localId: true } }),
        prisma.mikrotik.findMany({
          where: {
            ativo: true,
            ...(query.hotspotId || query.localId ? { hotspots: { some: hotspotWhere } } : {}),
          },
          include: { hotspots: { select: { id: true, nome: true, servidorHotspot: true, local: { select: { id: true, nome: true } } } } },
        }),
      ]);

      const days: string[] = [];
      for (const date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) {
        days.push(dateKey(date));
      }

      const accessByDay = days.map((day) => ({
        date: day,
        total: accessRows.filter((row) => dateKey(row.loginEm) === day).length,
      }));

      const accessByType = Object.values(LoginType).map((tipo) => ({
        tipo,
        total: accessRows.filter((row) => row.tipo === tipo).length,
      }));

      const localMap = new Map<string, { id: string; nome: string; total: number }>();
      const hotspotMap = new Map<string, { id: string; nome: string; total: number }>();
      for (const row of accessRows) {
        increment(hotspotMap, row.hotspot.id, row.hotspot.nome);
        increment(localMap, row.hotspot.local.id, row.hotspot.local.nome);
      }

      const activeClients = await Promise.all(
        activeMikrotiks.map(async (mikrotik) => {
          // Com varios locais no mesmo MikroTik, o campo "server" do cliente
          // ativo identifica de qual servidor hotspot (interface) ele veio.
          const hotspotByServer = new Map(
            mikrotik.hotspots
              .filter((hotspot) => hotspot.servidorHotspot)
              .map((hotspot) => [hotspot.servidorHotspot as string, hotspot]),
          );

          try {
            const clients = await listActiveHotspotClients(mikrotik);
            return clients.map((client) => {
              const hotspot = hotspotByServer.get(client.server) ?? mikrotik.hotspots[0];
              return {
                ...client,
                mikrotikId: mikrotik.id,
                mikrotikNome: mikrotik.nome,
                hotspotNome: hotspot?.nome ?? "-",
                localNome: hotspot?.local.nome ?? "-",
                error: null as string | null,
              };
            });
          } catch (error) {
            return [
              {
                id: `error-${mikrotik.id}`,
                username: "-",
                ip: "-",
                mac: "-",
                uptime: "-",
                loginBy: "-",
                server: "-",
                mikrotikId: mikrotik.id,
                mikrotikNome: mikrotik.nome,
                hotspotNome: mikrotik.hotspots[0]?.nome ?? "-",
                localNome: mikrotik.hotspots[0]?.local.nome ?? "-",
                error: error instanceof Error ? error.message : "Falha ao consultar clientes ativos.",
              },
            ];
          }
        }),
      );

      return {
        filters: {
          from: dateKey(from),
          to: dateKey(to),
          localId: query.localId ?? "",
          hotspotId: query.hotspotId ?? "",
          locais,
          hotspots: hotspotsList,
        },
        totals: {
          vouchersTotal,
          vouchersUsados,
          vouchersDisponiveis: vouchersTotal - vouchersUsados,
          hotspots,
          mikrotiks,
          acessos,
          clientesAtivos: activeClients.flat().filter((client) => !client.error).length,
        },
        accessByDay,
        accessByType,
        accessByLocal: [...localMap.values()].sort((a, b) => b.total - a.total),
        accessByHotspot: [...hotspotMap.values()].sort((a, b) => b.total - a.total),
        recentAccesses,
        activeClients: activeClients.flat(),
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return sendZodError(reply, error);
      }

      return sendCrudError(reply, error);
    }
  });

  app.post(
    "/dashboard/active-clients/:mikrotikId/disconnect",
    { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER)] },
    async (request, reply) => {
      try {
        const params = disconnectParamsSchema.parse(request.params);
        const body = disconnectBodySchema.parse(request.body);
        const mikrotik = await prisma.mikrotik.findUniqueOrThrow({ where: { id: params.mikrotikId } });
        await disconnectActiveHotspotClient(mikrotik, body.activeId);
        if (body.removeUser && body.username) {
          await removeHotspotUser(mikrotik, body.username);
        }
        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof ZodError) {
          return sendZodError(reply, error);
        }

        return sendCrudError(reply, error);
      }
    },
  );
}
