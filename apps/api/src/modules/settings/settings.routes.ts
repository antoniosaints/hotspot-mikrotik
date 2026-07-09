import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";
import { sendCrudError } from "../../utils/http.js";
import { AdminRole, getAdminPayload, requireAnyRole } from "../auth/permissions.js";

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

const resetSchema = z.object({
  tipo: z.enum(["acessos", "prospeccoes", "base"]),
  // Para o reset de base: entidades estruturais a preservar (padrao: manter
  // tudo, apagando apenas os dados operacionais).
  manter: z
    .object({
      equipamentos: z.boolean(),
      hotspots: z.boolean(),
      usuarios: z.boolean(),
      planos: z.boolean(),
      campanhas: z.boolean(),
      locais: z.boolean(),
    })
    .partial()
    .optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  const adminPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN)];
  const managerPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER)];

  app.get("/config", { preHandler: managerPreHandler }, async () => getConfig());

  app.put("/config", { preHandler: managerPreHandler }, async (request, reply) => {
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

  // Manutencao/reset de dados (apenas admin). Operacao destrutiva e irreversivel.
  app.post("/manutencao/reset", { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const body = resetSchema.parse(request.body);
      const contagens: Record<string, number> = {};
      const registrar = (chave: string, resultado: { count: number }) => {
        contagens[chave] = resultado.count;
      };

      if (body.tipo === "acessos") {
        registrar("acessos", await prisma.acesso.deleteMany({}));
        return { ok: true, tipo: body.tipo, contagens };
      }

      if (body.tipo === "prospeccoes") {
        const [leads, compras] = await prisma.$transaction([
          prisma.leadContratacao.deleteMany({}),
          prisma.compraAcesso.deleteMany({}),
        ]);
        registrar("leads", leads);
        registrar("compras", compras);
        return { ok: true, tipo: body.tipo, contagens };
      }

      // tipo === "base": mantem por padrao toda a estrutura, apagando so os dados
      // operacionais; cada flag "manter" desmarcada apaga tambem aquela entidade.
      const manter = {
        equipamentos: body.manter?.equipamentos ?? true,
        hotspots: body.manter?.hotspots ?? true,
        usuarios: body.manter?.usuarios ?? true,
        planos: body.manter?.planos ?? true,
        campanhas: body.manter?.campanhas ?? true,
        locais: body.manter?.locais ?? true,
      };

      // Hotspot referencia Mikrotik e Local com onDelete: Restrict, entao nao da
      // para remover equipamentos/locais mantendo os hotspots que os usam.
      if (manter.hotspots && (!manter.equipamentos || !manter.locais)) {
        return reply.status(400).send({
          error: "Para remover equipamentos ou locais, tambem e preciso remover os hotspots.",
        });
      }

      const adminId = getAdminPayload(request).id;

      const resultado = await prisma.$transaction(async (tx) => {
        // Dados operacionais: sempre apagados.
        registrar("consentimentos", await tx.consentimentoLgpd.deleteMany({}));
        registrar("dispositivos", await tx.dispositivo.deleteMany({}));
        registrar("acessos", await tx.acesso.deleteMany({}));
        registrar("compras", await tx.compraAcesso.deleteMany({}));
        registrar("leads", await tx.leadContratacao.deleteMany({}));
        registrar("vouchers", await tx.voucher.deleteMany({}));
        registrar("loginsCpf", await tx.cpfLogin.deleteMany({}));

        // Estrutura: apagada apenas quando nao marcada para manter, em ordem que
        // respeita as FKs (hotspots antes de equipamentos/locais).
        if (!manter.campanhas) registrar("campanhas", await tx.campanha.deleteMany({}));
        if (!manter.hotspots) registrar("hotspots", await tx.hotspot.deleteMany({}));
        if (!manter.planos) registrar("planos", await tx.plano.deleteMany({}));
        if (!manter.equipamentos) registrar("equipamentos", await tx.mikrotik.deleteMany({}));
        if (!manter.locais) registrar("locais", await tx.local.deleteMany({}));
        // Nunca remove o proprio admin que executa o reset (evita lock-out).
        if (!manter.usuarios) registrar("usuarios", await tx.admin.deleteMany({ where: { id: { not: adminId } } }));

        return contagens;
      });

      return { ok: true, tipo: body.tipo, manter, contagens: resultado };
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });
}
