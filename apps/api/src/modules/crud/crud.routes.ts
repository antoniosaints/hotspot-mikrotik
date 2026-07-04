import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db.js";
import {
  buildMikrotikAloginHtml,
  buildMikrotikLoginHtml,
  buildMikrotikLogoutHtml,
  buildMikrotikStatusHtml,
} from "../../services/template.service.js";
import { listHotspotUsers, removeHotspotUserById, testConnection } from "../../services/mikrotik.service.js";
import { normalizeCpf, normalizeVoucherCode } from "../../utils/normalization.js";
import { sendCrudError } from "../../utils/http.js";
import { AdminRole, requireAnyRole } from "../auth/permissions.js";

export { normalizeCpf, normalizeVoucherCode };

const idParamsSchema = z.object({ id: z.string().min(1) });
const hotspotFileParamsSchema = z.object({
  id: z.string().min(1),
  file: z.enum(["login", "alogin", "status", "logout"]),
});

const localCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});
const localUpdateSchema = localCreateSchema.partial();

const mikrotikCreateSchema = z.object({
  nome: z.string().min(1),
  host: z.string().min(1),
  usuarioApi: z.string().min(1),
  senhaApi: z.string().min(1),
  portaApi: z.number().int().positive().optional(),
  timeoutApi: z.number().int().positive().optional(),
  profilePadrao: z.string().min(1),
  ativo: z.boolean().optional(),
});
const mikrotikUpdateSchema = mikrotikCreateSchema.partial();

const integracaoCreateSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["IXC", "MERCADO_PAGO"]).optional(),
  baseUrl: z.string().optional().nullable(),
  usuario: z.string().optional().nullable(),
  senha: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
  chaveWebhook: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});
const integracaoUpdateSchema = integracaoCreateSchema.partial();

const hotspotCreateSchema = z.object({
  nome: z.string().min(1),
  slug: z.string().min(1),
  portalUrl: z.string().min(1),
  urlPosLogin: z.string().optional().nullable(),
  loginVoucher: z.boolean().optional(),
  loginCpf: z.boolean().optional(),
  loginIntegracao: z.boolean().optional(),
  integracaoTempoMinutos: z.number().int().positive().optional(),
  compraOnline: z.boolean().optional(),
  compraPersonalizada: z.boolean().optional(),
  valorMinutoCentavos: z.number().int().min(1).optional().nullable(),
  tempoPersonalizadoMinimo: z.number().int().positive().optional(),
  tempoPersonalizadoMaximo: z.number().int().positive().optional(),
  tempoPersonalizadoPasso: z.number().int().positive().optional(),
  conexoesPersonalizado: z.number().int().positive().optional(),
  ativo: z.boolean().optional(),
  localId: z.string().min(1),
  mikrotikId: z.string().min(1),
  integracaoId: z.string().optional().nullable(),
  pagamentoIntegracaoId: z.string().optional().nullable(),
  cadastroTelaId: z.string().optional().nullable(),
});
const hotspotUpdateSchema = hotspotCreateSchema.partial();

const voucherCreateSchema = z.object({
  codigo: z.string().transform(normalizeVoucherCode).refine((value) => value.length > 0),
  tempoMinutos: z.number().int().positive(),
  usado: z.boolean().optional(),
  vendido: z.boolean().optional(),
  vendidoEm: z.coerce.date().optional().nullable(),
  segmentacao: z.string().optional().nullable(),
  mac: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  usadoEm: z.coerce.date().optional().nullable(),
  hotspotId: z.string().min(1),
});
const voucherUpdateSchema = voucherCreateSchema.partial();

const cpfLoginCreateSchema = z.object({
  nome: z.string().min(1),
  cpf: z.string().transform(normalizeCpf).refine((value) => value.length > 0),
  telefone: z.string().optional().nullable(),
  tempoMinutos: z.number().int().positive(),
  ativo: z.boolean().optional(),
  usadoEm: z.coerce.date().optional().nullable(),
  hotspotId: z.string().min(1),
});
const cpfLoginUpdateSchema = cpfLoginCreateSchema.partial();

const generateVouchersSchema = z.object({
  hotspotId: z.string().min(1),
  quantidade: z.number().int().min(1).max(500),
  tempoMinutos: z.number().int().positive(),
  prefixo: z.string().optional().nullable().transform((value) => (value ? normalizeVoucherCode(value).slice(0, 12) : "")),
  segmentacao: z.string().optional().nullable(),
});

const usuarioCreateSchema = z.object({
  usuario: z.string().min(1),
  senha: z.string().min(6),
  role: z.enum(["admin", "manager", "user"]),
  nome: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.preprocess((value) => (value === "" ? null : value), z.string().email().optional().nullable()),
  ativo: z.boolean().optional(),
});
const usuarioUpdateSchema = z.object({
  usuario: z.string().min(1).optional(),
  senha: z.string().min(6).optional().nullable(),
  role: z.enum(["admin", "manager", "user"]).optional(),
  nome: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.preprocess((value) => (value === "" ? null : value), z.string().email().optional().nullable()),
  ativo: z.boolean().optional(),
});

const planoCreateSchema = z.object({
  nome: z.string().min(1),
  tempoMinutos: z.number().int().positive(),
  conexoesSimultaneas: z.number().int().positive().optional(),
  valorCentavos: z.number().int().min(0),
  ativo: z.boolean().optional(),
  coletarNome: z.boolean().optional(),
  coletarTelefone: z.boolean().optional(),
  coletarEmail: z.boolean().optional(),
  coletarCpf: z.boolean().optional(),
  coletarEndereco: z.boolean().optional(),
  hotspotId: z.string().min(1),
});
const planoUpdateSchema = planoCreateSchema.partial();

const cadastroTelaCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  coletarNome: z.boolean().optional(),
  coletarEmail: z.boolean().optional(),
  coletarEndereco: z.boolean().optional(),
  coletarCidade: z.boolean().optional(),
  coletarCep: z.boolean().optional(),
  coletarTelefone: z.boolean().optional(),
  coletarWhatsapp: z.boolean().optional(),
  coletarCpf: z.boolean().optional(),
  bonusTempoMinutos: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});
const cadastroTelaUpdateSchema = cadastroTelaCreateSchema.partial();

type CrudDelegate<TCreate, TUpdate> = {
  findMany(args?: unknown): Promise<unknown[]>;
  create(args: { data: TCreate }): Promise<unknown>;
  update(args: { where: { id: string }; data: TUpdate }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

const VOUCHER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
type HotspotFile = z.infer<typeof hotspotFileParamsSchema>["file"];
type HotspotTemplateData = { portalUrl: string; slug: string; urlPosLogin: string | null };

const hotspotFileBuilders: Record<HotspotFile, (hotspot: HotspotTemplateData) => string> = {
  login: (hotspot) => buildMikrotikLoginHtml(hotspot.portalUrl, hotspot.slug),
  alogin: (hotspot) => buildMikrotikAloginHtml(hotspot.urlPosLogin ?? ""),
  status: () => buildMikrotikStatusHtml(),
  logout: () => buildMikrotikLogoutHtml(),
};

function randomVoucherCode(prefix = "", length = 8) {
  let code = prefix;
  const randomLength = Math.max(4, length - prefix.length);
  for (let index = 0; index < randomLength; index += 1) {
    code += VOUCHER_ALPHABET[Math.floor(Math.random() * VOUCHER_ALPHABET.length)];
  }
  return code;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function registerCrud<TCreate, TUpdate>(
  app: FastifyInstance,
  path: string,
  delegate: CrudDelegate<TCreate, TUpdate>,
  createSchema: z.ZodType<TCreate>,
  updateSchema: z.ZodType<TUpdate>,
  listArgs?: unknown,
  options: { skipDelete?: boolean; roles?: AdminRole[]; readRoles?: AdminRole[]; writeRoles?: AdminRole[] } = {},
) {
  const writeRoles = options.writeRoles ?? options.roles ?? [AdminRole.ADMIN];
  const readRoles = options.readRoles ?? writeRoles;
  const readPreHandler = [app.authenticate, requireAnyRole(...readRoles)];
  const writePreHandler = [app.authenticate, requireAnyRole(...writeRoles)];

  app.get(path, { preHandler: readPreHandler }, async () => delegate.findMany(listArgs));

  app.post(path, { preHandler: writePreHandler }, async (request, reply) => {
    try {
      return await delegate.create({ data: createSchema.parse(request.body) });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.put(`${path}/:id`, { preHandler: writePreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      return await delegate.update({ where: { id: params.id }, data: updateSchema.parse(request.body) });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  if (!options.skipDelete) {
    app.delete(`${path}/:id`, { preHandler: writePreHandler }, async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        return await delegate.delete({ where: { id: params.id } });
      } catch (error) {
        return sendCrudError(reply, error);
      }
    });
  }
}

function maskIntegracao(integracao: unknown) {
  if (!integracao || typeof integracao !== "object") return integracao;
  const item = { ...(integracao as Record<string, unknown>) };
  if (item.senha) item.senha = "********";
  if (item.token) item.token = "********";
  if (item.chaveWebhook) item.chaveWebhook = "********";
  return item;
}

function cleanMaskedSecrets<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== "********"),
  ) as T;
}

async function assertNotRemovingLastAdmin(id: string, data: { role?: string; ativo?: boolean }) {
  if (data.role !== "admin" || data.ativo !== false) return;

  const activeAdmins = await prisma.admin.count({
    where: { role: "admin", ativo: true, id: { not: id } },
  });

  if (activeAdmins === 0) {
    throw new Error("Nao e permitido desativar o ultimo administrador ativo.");
  }
}

export async function crudRoutes(app: FastifyInstance) {
  registerCrud(app, "/locais", prisma.local, localCreateSchema, localUpdateSchema, {
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.MANAGER] });

  registerCrud(app, "/mikrotiks", prisma.mikrotik, mikrotikCreateSchema, mikrotikUpdateSchema, {
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.MANAGER] });

  const managerPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER)];
  const adminPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN)];

  app.get("/integracoes", { preHandler: managerPreHandler }, async () => {
    const items = await prisma.integracao.findMany({ orderBy: { criadoEm: "desc" } });
    return items.map(maskIntegracao);
  });

  app.post("/integracoes", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      return await prisma.integracao.create({ data: integracaoCreateSchema.parse(request.body) });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.put("/integracoes/:id", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const data = cleanMaskedSecrets(integracaoUpdateSchema.parse(request.body));
      return maskIntegracao(await prisma.integracao.update({ where: { id: params.id }, data }));
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.delete("/integracoes/:id", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      return await prisma.integracao.delete({ where: { id: params.id } });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.get("/usuarios", { preHandler: adminPreHandler }, async () =>
    prisma.admin.findMany({
      orderBy: { criadoEm: "desc" },
      select: { id: true, usuario: true, nome: true, telefone: true, email: true, role: true, ativo: true, criadoEm: true, atualizadoEm: true },
    }),
  );

  app.post("/usuarios", { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const body = usuarioCreateSchema.parse(request.body);
      const senhaHash = await bcrypt.hash(body.senha, 10);
      return await prisma.admin.create({
        data: {
          usuario: body.usuario,
          senhaHash,
          role: body.role,
          nome: body.nome,
          telefone: body.telefone,
          email: body.email,
          ativo: body.ativo ?? true,
        },
        select: { id: true, usuario: true, nome: true, telefone: true, email: true, role: true, ativo: true, criadoEm: true, atualizadoEm: true },
      });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.put("/usuarios/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const body = usuarioUpdateSchema.parse(request.body);
      await assertNotRemovingLastAdmin(params.id, body);
      const { senha, ...rest } = body;
      return await prisma.admin.update({
        where: { id: params.id },
        data: { ...rest, ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}) },
        select: { id: true, usuario: true, nome: true, telefone: true, email: true, role: true, ativo: true, criadoEm: true, atualizadoEm: true },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("ultimo administrador")) {
        return reply.status(400).send({ error: error.message });
      }
      return sendCrudError(reply, error);
    }
  });

  app.delete("/usuarios/:id", { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      await assertNotRemovingLastAdmin(params.id, { role: "admin", ativo: false });
      return await prisma.admin.delete({ where: { id: params.id } });
    } catch (error) {
      if (error instanceof Error && error.message.includes("ultimo administrador")) {
        return reply.status(400).send({ error: error.message });
      }
      return sendCrudError(reply, error);
    }
  });

  app.post("/mikrotiks/:id/test", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const mikrotik = await prisma.mikrotik.findUniqueOrThrow({ where: { id: params.id } });
      return await testConnection(mikrotik);
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.get("/mikrotiks/:id/users", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const mikrotik = await prisma.mikrotik.findUniqueOrThrow({ where: { id: params.id } });
      return { users: await listHotspotUsers(mikrotik) };
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.delete("/mikrotiks/:id/users/:userId", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string().min(1), userId: z.string().min(1) }).parse(request.params);
      const mikrotik = await prisma.mikrotik.findUniqueOrThrow({ where: { id: params.id } });
      await removeHotspotUserById(mikrotik, params.userId);
      return reply.send({ ok: true });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  registerCrud(app, "/hotspots", prisma.hotspot, hotspotCreateSchema, hotspotUpdateSchema, {
    include: { local: true, mikrotik: true, integracao: true, pagamentoIntegracao: true, cadastroTela: true },
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.MANAGER] });

  app.get("/hotspots-options", { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.USER)] }, async () =>
    prisma.hotspot.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, localId: true, mikrotikId: true, ativo: true },
    }),
  );

  app.get("/hotspots/:id/:file-html", { preHandler: managerPreHandler }, async (request, reply) => {
    try {
      const params = hotspotFileParamsSchema.parse(request.params);
      const hotspot = await prisma.hotspot.findUniqueOrThrow({ where: { id: params.id } });
      const html = hotspotFileBuilders[params.file](hotspot);

      return reply
        .type("text/html")
        .header("content-disposition", `attachment; filename="${params.file}.html"`)
        .send(html);
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  registerCrud(
    app,
    "/vouchers",
    prisma.voucher,
    voucherCreateSchema,
    voucherUpdateSchema,
    {
      include: { hotspot: true },
      orderBy: { criadoEm: "desc" },
    },
    { roles: [AdminRole.ADMIN, AdminRole.USER], skipDelete: true },
  );

  app.delete("/vouchers/:id", { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.USER)] }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      const voucher = await prisma.voucher.findUnique({ where: { id: params.id }, select: { usado: true } });
      if (voucher?.usado) {
        return reply.status(400).send({ error: "Voucher usado nao pode ser excluido." });
      }
      return await prisma.voucher.delete({ where: { id: params.id } });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.post("/vouchers/generate", { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.USER)] }, async (request, reply) => {
    try {
      const body = generateVouchersSchema.parse(request.body);
      const created = await prisma.$transaction(async (tx) => {
        const vouchers = [];

        for (let index = 0; index < body.quantidade; index += 1) {
          let created = null;

          for (let attempt = 0; attempt < 20; attempt += 1) {
            try {
              created = await tx.voucher.create({
                data: {
                  codigo: randomVoucherCode(body.prefixo),
                  tempoMinutos: body.tempoMinutos,
                  hotspotId: body.hotspotId,
                  segmentacao: body.segmentacao,
                },
              });
              break;
            } catch (error) {
              if (!isUniqueConstraintError(error)) {
                throw error;
              }
            }
          }

          if (!created) {
            throw new Error("Nao foi possivel gerar codigo unico de voucher.");
          }

          vouchers.push(created);
        }

        return vouchers;
      });

      return reply.status(201).send({ vouchers: created });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  app.post("/vouchers/:id/sell", { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.USER)] }, async (request, reply) => {
    try {
      const params = idParamsSchema.parse(request.params);
      return await prisma.voucher.update({
        where: { id: params.id },
        data: { vendido: true, vendidoEm: new Date() },
      });
    } catch (error) {
      return sendCrudError(reply, error);
    }
  });

  registerCrud(app, "/cadastros-telas", prisma.cadastroTela, cadastroTelaCreateSchema, cadastroTelaUpdateSchema, {
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.MANAGER] });

  registerCrud(app, "/cpf-logins", prisma.cpfLogin, cpfLoginCreateSchema, cpfLoginUpdateSchema, {
    include: { hotspot: true },
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.USER] });

  registerCrud(app, "/planos", prisma.planoBilheteria, planoCreateSchema, planoUpdateSchema, {
    include: { hotspot: true },
    orderBy: { criadoEm: "desc" },
  }, { roles: [AdminRole.ADMIN, AdminRole.MANAGER] });

  app.get("/prospeccoes", { preHandler: managerPreHandler }, async (request) => {
    const query = z.object({
      hotspotId: z.string().optional(),
      planoId: z.string().optional(),
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(request.query);

    const from = query.from ? new Date(`${query.from}T00:00:00`) : undefined;
    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;

    const compras = await prisma.compraAcesso.findMany({
      where: {
        ...(query.hotspotId ? { hotspotId: query.hotspotId } : {}),
        ...(query.planoId ? { planoId: query.planoId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(from || to ? { criadoEm: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        OR: [
          { nome: { not: null } },
          { telefone: { not: null } },
          { email: { not: null } },
          { cpf: { not: null } },
          { endereco: { not: null } },
        ],
      },
      include: { hotspot: true, plano: true },
      orderBy: { criadoEm: "desc" },
    });

    const leads = await prisma.leadContratacao.findMany({
      where: {
        ...(query.hotspotId ? { hotspotId: query.hotspotId } : {}),
        ...(from || to ? { criadoEm: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { hotspot: true, cadastroTela: true },
      orderBy: { criadoEm: "desc" },
    });

    return [
      ...leads.map((lead) => ({ ...lead, origem: "Quero contratar", status: "LEAD", plano: null })),
      ...compras.map((compra) => ({ ...compra, origem: "Compra PIX" })),
    ].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  });
}
