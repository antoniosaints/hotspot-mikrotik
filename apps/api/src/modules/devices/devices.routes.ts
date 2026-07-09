import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { disconnectActiveHotspotClient, removeHotspotUser } from "../../services/mikrotik.service.js";
import { sendCrudError, sendZodError } from "../../utils/http.js";
import { normalizeCpf, normalizeMac } from "../../utils/normalization.js";
import { RoleGroup, requireAnyRole } from "../auth/permissions.js";
import { buscarSessoesAtivasPorMac, listarMacsOnline } from "./devices.service.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

const optionalText = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

const dispositivoUpdateSchema = z.object({
  nome: optionalText,
  email: optionalText,
  cpf: z
    .string()
    .optional()
    .nullable()
    .transform((value) => {
      const normalized = value ? normalizeCpf(value) : "";
      return normalized ? normalized : null;
    }),
  telefone: optionalText,
  whatsapp: optionalText,
  endereco: optionalText,
  cidade: optionalText,
  cep: optionalText,
  aceitouTermos: z.boolean().optional(),
});

const disconnectBodySchema = z.object({
  mikrotikId: z.string().min(1),
  activeId: z.string().min(1),
  username: z.string().optional(),
  removeUser: z.boolean().optional(),
});

export async function devicesRoutes(app: FastifyInstance) {
  // Leitura: todos os papeis com acesso ao menu. Escrita (editar/desconectar):
  // apenas quem gerencia dispositivos.
  const readPreHandler = [app.authenticate, requireAnyRole(...RoleGroup.READ_WIDE)];
  const writePreHandler = [app.authenticate, requireAnyRole(...RoleGroup.DEVICES_WRITE)];

  app.get("/dispositivos", { preHandler: readPreHandler }, async () =>
    prisma.dispositivo.findMany({
      orderBy: [{ ultimaConexao: "desc" }, { criadoEm: "desc" }],
      include: { ultimoHotspot: { select: { id: true, nome: true } } },
    }),
  );

  // MACs online agora (consulta ao vivo). Endpoint separado para a tabela
  // carregar instantaneamente e preencher a coluna "Online" em seguida.
  app.get("/dispositivos/online", { preHandler: readPreHandler }, async () => listarMacsOnline());

  app.put("/dispositivos/:id", { preHandler: writePreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const data = dispositivoUpdateSchema.parse(request.body);
      return await prisma.dispositivo.update({
        where: { id: params.id },
        data,
        include: { ultimoHotspot: { select: { id: true, nome: true } } },
      });
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  // Detalhes: dados do dispositivo + historico de conexoes (Acesso pelo mesmo
  // MAC) + sessoes ativas ao vivo (para permitir desconectar).
  app.get("/dispositivos/:id/detalhes", { preHandler: readPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const dispositivo = await prisma.dispositivo.findUnique({
        where: { id: params.id },
        include: { ultimoHotspot: { select: { id: true, nome: true } } },
      });

      if (!dispositivo) {
        return reply.status(404).send({ error: "Dispositivo nao encontrado." });
      }

      const conexoes = await prisma.acesso.findMany({
        where: { mac: normalizeMac(dispositivo.mac) },
        orderBy: { loginEm: "desc" },
        take: 100,
        include: {
          hotspot: { select: { nome: true } },
          mikrotik: { select: { nome: true } },
        },
      });

      const { sessoes, erro } = await buscarSessoesAtivasPorMac(dispositivo.mac);

      return { dispositivo, conexoes, sessoesAtivas: sessoes, sessoesErro: erro };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/dispositivos/:id/disconnect", { preHandler: writePreHandler }, async (request, reply) => {
    try {
      idParamsSchema.parse(request.params);
      const body = disconnectBodySchema.parse(request.body);
      const mikrotik = await prisma.mikrotik.findUniqueOrThrow({ where: { id: body.mikrotikId } });
      await disconnectActiveHotspotClient(mikrotik, body.activeId);
      if (body.removeUser && body.username) {
        await removeHotspotUser(mikrotik, body.username);
      }
      return reply.send({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });
}
