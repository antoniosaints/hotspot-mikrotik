import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { sendCrudError, sendZodError } from "../../utils/http.js";

const querySchema = z.object({
  // Limite de eventos por tipo (padrao 15). O agregado final tambem e limitado.
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type NotificacaoTipo = "conexao" | "cadastro" | "compra";

export type Notificacao = {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  descricao: string;
  data: string;
  hotspotNome: string | null;
};

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TIPO_LABEL: Record<string, string> = {
  VOUCHER: "Voucher",
  CPF: "CPF",
  IXC: "Integracao",
  COMPRA: "Compra",
  CONTRATACAO: "Contratacao",
};

export async function notificationsRoutes(app: FastifyInstance) {
  // Feed de eventos recentes para o sino de notificacoes. Disponivel a qualquer
  // papel autenticado; o cliente decide o que ja foi visto (por timestamp).
  app.get("/notificacoes", { preHandler: app.authenticate }, async (request, reply) => {
    try {
      const query = querySchema.parse(request.query);
      const take = query.limit ?? 15;
      // Janela de 48h: suficiente para o feed sem varrer a base inteira.
      const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const [conexoes, cadastros, compras] = await Promise.all([
        prisma.acesso.findMany({
          where: { loginEm: { gte: desde } },
          orderBy: { loginEm: "desc" },
          take,
          include: { hotspot: { select: { nome: true } } },
        }),
        prisma.leadContratacao.findMany({
          where: { criadoEm: { gte: desde } },
          orderBy: { criadoEm: "desc" },
          take,
          include: { hotspot: { select: { nome: true } } },
        }),
        prisma.compraAcesso.findMany({
          where: { status: { in: ["PAGO", "LIBERADO"] }, pagoEm: { gte: desde } },
          orderBy: { pagoEm: "desc" },
          take,
          include: { hotspot: { select: { nome: true } } },
        }),
      ]);

      const eventos: Notificacao[] = [
        ...conexoes.map((acesso) => ({
          id: `conexao:${acesso.id}`,
          tipo: "conexao" as const,
          titulo: "Nova conexao",
          descricao: `${TIPO_LABEL[acesso.tipo] ?? acesso.tipo} · ${acesso.codigo}`,
          data: acesso.loginEm.toISOString(),
          hotspotNome: acesso.hotspot?.nome ?? null,
        })),
        ...cadastros.map((lead) => ({
          id: `cadastro:${lead.id}`,
          tipo: "cadastro" as const,
          titulo: "Novo cadastro",
          descricao: lead.nome ?? lead.email ?? lead.telefone ?? "Lead sem nome",
          data: lead.criadoEm.toISOString(),
          hotspotNome: lead.hotspot?.nome ?? null,
        })),
        ...compras.map((compra) => ({
          id: `compra:${compra.id}`,
          tipo: "compra" as const,
          titulo: "Nova compra",
          descricao: `${formatBRL(compra.valorCentavos)}${compra.nome ? ` · ${compra.nome}` : ""}`,
          data: (compra.pagoEm ?? compra.criadoEm).toISOString(),
          hotspotNome: compra.hotspot?.nome ?? null,
        })),
      ]
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .slice(0, 30);

      return { eventos, serverTime: new Date().toISOString() };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });
}
