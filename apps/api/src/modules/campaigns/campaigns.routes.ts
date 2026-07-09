import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { sendCrudError } from "../../utils/http.js";
import { RoleGroup, requireAnyRole } from "../auth/permissions.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

const campanhaBaseSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["IMAGEM", "VIDEO", "HTML", "CUSTOM"]).optional(),
  momento: z.enum(["ANTES_LOGIN", "DEPOIS_LOGIN"]).optional(),
  ativo: z.boolean().optional(),
  prioridade: z.number().int().optional(),
  dataInicio: z.coerce.date().optional().nullable(),
  dataFim: z.coerce.date().optional().nullable(),
  diasSemana: z.string().optional(),
  horaInicio: z.string().optional().nullable(),
  horaFim: z.string().optional().nullable(),
  exibicao: z.enum(["SEMPRE", "UMA_VEZ", "POR_SESSAO"]).optional(),
  duracaoSegundos: z.number().int().min(0).optional().nullable(),
  permitePular: z.boolean().optional(),
  ctaTexto: z.string().optional().nullable(),
  ctaUrl: z.string().optional().nullable(),
  imagemUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  htmlConteudo: z.string().optional().nullable(),
  titulo: z.string().optional().nullable(),
  subtitulo: z.string().optional().nullable(),
  texto: z.string().optional().nullable(),
  corFundo: z.string().optional().nullable(),
  corTexto: z.string().optional().nullable(),
  blocos: z.string().optional().nullable(),
  todosHotspots: z.boolean().optional(),
  hotspotIds: z.array(z.string()).optional(),
});

const campanhaCreateSchema = campanhaBaseSchema;
const campanhaUpdateSchema = campanhaBaseSchema.partial();

// Payload de criacao: nome e obrigatorio; relacao m2n via connect.
function toCreateData(input: z.infer<typeof campanhaCreateSchema>): Prisma.CampanhaCreateInput {
  const { hotspotIds, ...scalars } = input;
  return {
    ...scalars,
    nome: input.nome,
    ...(hotspotIds ? { hotspots: { connect: hotspotIds.map((id) => ({ id })) } } : {}),
  };
}

// Payload de atualizacao: campos parciais; relacao m2n via set (substitui a lista).
function toUpdateData(input: z.infer<typeof campanhaUpdateSchema>): Prisma.CampanhaUpdateInput {
  const { hotspotIds, ...scalars } = input;
  return {
    ...scalars,
    ...(hotspotIds !== undefined ? { hotspots: { set: hotspotIds.map((id) => ({ id })) } } : {}),
  };
}

const includeHotspots = { hotspots: { select: { id: true, nome: true } } } as const;

// Avalia se uma campanha esta ativa no instante `agora`, considerando janela de
// datas, dias da semana (0=Dom) e janela de horario diaria. Horario do servidor.
export function campanhaEstaAtiva(
  campanha: {
    ativo: boolean;
    dataInicio: Date | null;
    dataFim: Date | null;
    diasSemana: string;
    horaInicio: string | null;
    horaFim: string | null;
  },
  agora: Date,
): boolean {
  if (!campanha.ativo) return false;
  if (campanha.dataInicio && agora < campanha.dataInicio) return false;
  if (campanha.dataFim && agora > campanha.dataFim) return false;

  const dias = campanha.diasSemana
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (dias.length > 0 && !dias.includes(String(agora.getDay()))) return false;

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const inicio = parseHoraMinutos(campanha.horaInicio);
  const fim = parseHoraMinutos(campanha.horaFim);
  if (inicio !== null && fim !== null) {
    // Janela que cruza a meia-noite (ex.: 22:00-06:00).
    if (inicio <= fim) {
      if (minutosAgora < inicio || minutosAgora > fim) return false;
    } else if (minutosAgora < inicio && minutosAgora > fim) {
      return false;
    }
  } else if (inicio !== null && minutosAgora < inicio) {
    return false;
  } else if (fim !== null && minutosAgora > fim) {
    return false;
  }

  return true;
}

function parseHoraMinutos(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

export async function campaignsRoutes(app: FastifyInstance) {
  const managerPreHandler = [app.authenticate, requireAnyRole(...RoleGroup.MARKETING_MANAGE)];

  app.get("/campanhas", { preHandler: managerPreHandler }, async () =>
    prisma.campanha.findMany({ include: includeHotspots, orderBy: [{ prioridade: "desc" }, { criadoEm: "desc" }] }),
  );

  app.post("/campanhas", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const input = campanhaCreateSchema.parse(request.body);
      return await prisma.campanha.create({ data: toCreateData(input), include: includeHotspots });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.put("/campanhas/:id", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const input = campanhaUpdateSchema.parse(request.body);
      return await prisma.campanha.update({
        where: { id: params.id },
        data: toUpdateData(input),
        include: includeHotspots,
      });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.delete("/campanhas/:id", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      await prisma.campanha.delete({ where: { id: params.id } });
      return { ok: true };
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });
}
