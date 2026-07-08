import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";
import { sendCrudError } from "../../utils/http.js";
import { AdminRole, requireAnyRole } from "../auth/permissions.js";

// Configuracao e um singleton: sempre a linha de id "global".
export const CONFIG_ID = "global";

export async function getConfig() {
  return prisma.configuracao.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

const configUpdateSchema = z.object({
  termosUso: z.string().optional(),
  politicaPrivacidade: z.string().optional(),
  lgpdConsentimentoTexto: z.string().min(1).optional(),
  lgpdVersao: z.string().min(1).optional(),
  exigirConsentimento: z.boolean().optional(),
  encarregadoNome: z.string().optional().nullable(),
  encarregadoEmail: z.string().optional().nullable(),
  empresaNome: z.string().optional().nullable(),
  empresaDocumento: z.string().optional().nullable(),
});

const consentimentosQuerySchema = z.object({
  hotspotId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  const adminPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN)];
  const managerPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER)];

  app.get("/config", { preHandler: managerPreHandler }, async () => getConfig());

  app.put("/config", { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const data = configUpdateSchema.parse(request.body);
      await getConfig();
      return await prisma.configuracao.update({ where: { id: CONFIG_ID }, data });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.get("/config/consentimentos", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const query = consentimentosQuerySchema.parse(request.query);
      const where: Record<string, unknown> = {};
      if (query.hotspotId) where.hotspotId = query.hotspotId;
      if (query.from || query.to) {
        where.aceitoEm = {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        };
      }

      return await prisma.consentimentoLgpd.findMany({
        where,
        include: { hotspot: { select: { id: true, nome: true, slug: true } } },
        orderBy: { aceitoEm: "desc" },
        take: 500,
      });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });
}
