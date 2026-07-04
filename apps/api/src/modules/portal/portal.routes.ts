import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { getIxcInvoicePix, listCurrentMonthOpenInvoices, validateIxcLogin, type IxcConfig } from "../../services/ixc.service.js";
import { createHotspotUser, removeHotspotUser } from "../../services/mikrotik.service.js";
import { buildFinalLoginHtml } from "../../services/router-login.service.js";
import { AccessStatus, LoginType } from "../../types.js";
import { addMinutes, sendCrudError, sendZodError } from "../../utils/http.js";
import { normalizeCpf, normalizeVoucherCode } from "../../utils/normalization.js";

const slugParamsSchema = z.object({ slug: z.string().min(1) });
const ixcInvoiceSchema = z.object({
  hotspotSlug: z.string().min(1),
  cpf: z.string().min(1),
});
const portalLoginRawSchema = z.object({
  loginType: z.enum(["voucher", "cpf", "ixc"]),
  hotspotSlug: z.string().min(1),
  codigo: z.string().optional().nullable(),
  voucher: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  mac: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  linkLogin: z.string().optional().nullable(),
  linkLoginOnly: z.string().optional().nullable(),
  linkOrig: z.string().optional().nullable(),
  chapId: z.string().optional().nullable(),
  chapChallenge: z.string().optional().nullable(),
  chapIdB64: z.string().optional().nullable(),
  chapChallengeB64: z.string().optional().nullable(),
  "link-login": z.string().optional().nullable(),
  "link-login-only": z.string().optional().nullable(),
  "link-orig": z.string().optional().nullable(),
  "chap-id": z.string().optional().nullable(),
  "chap-challenge": z.string().optional().nullable(),
  "chap-id-b64": z.string().optional().nullable(),
  "chap-challenge-b64": z.string().optional().nullable(),
});
const leadContratacaoSchema = z.object({
  hotspotSlug: z.string().min(1),
  nome: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
}).merge(portalLoginRawSchema.omit({ loginType: true, hotspotSlug: true, codigo: true, voucher: true, cpf: true }).partial());

const ixcRecheckSchema = portalLoginRawSchema.extend({
  invoiceId: z.string().optional().nullable(),
});
const ixcPixSchema = ixcInvoiceSchema
  .extend({
    invoiceId: z.string().min(1),
  })
  .merge(portalLoginRawSchema.omit({ loginType: true, hotspotSlug: true, cpf: true }).partial());

function decodeBase64(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return Buffer.from(value, "base64").toString("utf8");
}

type PortalLoginBody = ReturnType<typeof normalizePortalLoginBody>;

export function normalizePortalLoginBody(input: unknown) {
  const body = portalLoginRawSchema.parse(input);
  const codigo = body.codigo ?? body.voucher;

  return {
    loginType: body.loginType,
    hotspotSlug: body.hotspotSlug,
    codigo: codigo ? normalizeVoucherCode(codigo) : undefined,
    voucher: body.voucher ? normalizeVoucherCode(body.voucher) : undefined,
    cpf: body.cpf,
    mac: body.mac,
    ip: body.ip,
    linkLogin: body.linkLogin ?? body["link-login"],
    linkLoginOnly: body.linkLoginOnly ?? body["link-login-only"],
    linkOrig: body.linkOrig ?? body["link-orig"],
    chapId: body.chapId ?? body["chap-id"],
    chapChallenge: body.chapChallenge ?? body["chap-challenge"],
    chapIdB64: body.chapIdB64 ?? body["chap-id-b64"],
    chapChallengeB64: body.chapChallengeB64 ?? body["chap-challenge-b64"],
  };
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 12);
}

function randomIxcPaymentCode() {
  return `IXC${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function randomLeadBonusCode() {
  return `CAD${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

async function getIxcHotspot(slug: string) {
  const hotspot = await prisma.hotspot.findUnique({
    where: { slug },
    include: { mikrotik: true, integracao: true },
  });

  if (!hotspot || !hotspot.ativo || !hotspot.loginIntegracao) {
    return null;
  }

  if (
    !hotspot.integracao ||
    !hotspot.integracao.ativo ||
    hotspot.integracao.tipo !== "IXC" ||
    !hotspot.integracao.baseUrl ||
    !hotspot.integracao.usuario ||
    !hotspot.integracao.senha
  ) {
    return null;
  }

  return hotspot;
}

function ixcConfigFromHotspot(hotspot: NonNullable<Awaited<ReturnType<typeof getIxcHotspot>>>): IxcConfig {
  return {
    baseUrl: hotspot.integracao?.baseUrl ?? "",
    usuario: hotspot.integracao?.usuario ?? "",
    senha: hotspot.integracao?.senha ?? "",
  };
}

function finalLoginHtml(body: ReturnType<typeof normalizePortalLoginBody>, username: string, password: string) {
  return buildFinalLoginHtml({
    linkLoginOnly: body.linkLoginOnly,
    linkLogin: body.linkLogin,
    username,
    password,
    dst: body.linkOrig,
    chapId: body.chapId ?? decodeBase64(body.chapIdB64),
    chapChallenge: body.chapChallenge ?? decodeBase64(body.chapChallengeB64),
  });
}

export async function portalRoutes(app: FastifyInstance) {
  app.get("/portal/:slug", async (request, reply) => {
    try {
      const params = slugParamsSchema.parse(request.params);
      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: params.slug },
        select: {
          id: true,
          nome: true,
          slug: true,
          portalUrl: true,
          loginVoucher: true,
          loginCpf: true,
          loginIntegracao: true,
          compraOnline: true,
          compraPersonalizada: true,
          valorMinutoCentavos: true,
          tempoPersonalizadoMinimo: true,
          tempoPersonalizadoMaximo: true,
          tempoPersonalizadoPasso: true,
          conexoesPersonalizado: true,
          ativo: true,
          local: { select: { id: true, nome: true } },
          integracao: { select: { id: true, nome: true, tipo: true, ativo: true } },
          pagamentoIntegracao: { select: { id: true, nome: true, tipo: true, ativo: true } },
          cadastroTela: true,
          planos: {
            where: { ativo: true },
            orderBy: { valorCentavos: "asc" },
            select: {
              id: true,
              nome: true,
              tempoMinutos: true,
              conexoesSimultaneas: true,
              valorCentavos: true,
              coletarNome: true,
              coletarTelefone: true,
              coletarEmail: true,
              coletarCpf: true,
              coletarEndereco: true,
            },
          },
        },
      });

      if (!hotspot || !hotspot.ativo) {
        return reply.status(404).send({ error: "Hotspot nao encontrado." });
      }

      return {
        hotspot,
        loginTypes: {
          voucher: hotspot.loginVoucher,
          cpf: hotspot.loginCpf,
          ixc: hotspot.loginIntegracao && Boolean(hotspot.integracao?.ativo),
          compra:
            hotspot.compraOnline &&
            Boolean(hotspot.pagamentoIntegracao?.ativo) &&
            (hotspot.planos.length > 0 || (hotspot.compraPersonalizada && Number(hotspot.valorMinutoCentavos) > 0)),
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return sendZodError(reply, error);
      }

      throw error;
    }
  });

  app.post("/portal/ixc/invoices", async (request, reply) => {
    try {
      const body = ixcInvoiceSchema.parse(request.body);
      const hotspot = await getIxcHotspot(body.hotspotSlug);
      if (!hotspot) {
        return reply.status(400).send({ error: "Integracao IXC nao configurada para este hotspot." });
      }

      const validation = await validateIxcLogin(ixcConfigFromHotspot(hotspot), body.cpf);
      if (validation.allowed) {
        return { status: "LIBERADO", invoices: [] };
      }

      if (validation.code === "CLIENTE_NAO_ENCONTRADO") {
        return reply.status(404).send({ error: validation.reason, code: validation.code });
      }

      const invoices = await listCurrentMonthOpenInvoices(ixcConfigFromHotspot(hotspot), validation.clienteId);
      return { status: "CLIENTE_COM_DEBITOS", clienteId: validation.clienteId, invoices };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/leads", async (request, reply) => {
    try {
      const body = leadContratacaoSchema.parse(request.body);
      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: body.hotspotSlug },
        include: { cadastroTela: true, mikrotik: true },
      });

      if (!hotspot || !hotspot.ativo || !hotspot.cadastroTela || !hotspot.cadastroTela.ativo) {
        return reply.status(400).send({ error: "Cadastro de novos clientes indisponivel neste hotspot." });
      }

      const tela = hotspot.cadastroTela;
      const lead = await prisma.leadContratacao.create({
        data: {
          nome: tela.coletarNome ? body.nome : null,
          email: tela.coletarEmail ? (body.email || null) : null,
          endereco: tela.coletarEndereco ? body.endereco : null,
          cidade: tela.coletarCidade ? body.cidade : null,
          cep: tela.coletarCep ? body.cep : null,
          telefone: tela.coletarTelefone ? body.telefone : null,
          whatsapp: tela.coletarWhatsapp ? body.whatsapp : null,
          cpf: tela.coletarCpf && body.cpf ? normalizeCpf(body.cpf) : null,
          hotspotId: hotspot.id,
          cadastroTelaId: tela.id,
        },
      });

      const bonusMinutes = Math.max(0, tela.bonusTempoMinutos);
      if (bonusMinutes <= 0) {
        return reply.status(201).send({ id: lead.id, message: "Cadastro enviado com sucesso. Em breve entraremos em contato." });
      }

      const bonusCode = randomLeadBonusCode();
      const now = new Date();

      if (hotspot.mikrotik.ativo) {
        await createHotspotUser(
          hotspot.mikrotik,
          bonusCode,
          bonusCode,
          bonusMinutes,
          hotspot.mikrotik.profilePadrao,
          "Hotspot CONTRATACAO",
        );
      }

      await prisma.acesso.create({
        data: {
          tipo: LoginType.CONTRATACAO,
          codigo: bonusCode,
          mac: body.mac,
          ip: body.ip,
          loginEm: now,
          expiraEm: addMinutes(now, bonusMinutes),
          status: AccessStatus.LIBERADO,
          hotspotId: hotspot.id,
          mikrotikId: hotspot.mikrotikId,
        },
      });

      const html = buildFinalLoginHtml({
        linkLoginOnly: body.linkLoginOnly ?? body["link-login-only"],
        linkLogin: body.linkLogin ?? body["link-login"],
        username: bonusCode,
        password: bonusCode,
        dst: body.linkOrig ?? body["link-orig"],
        chapId: body.chapId ?? body["chap-id"] ?? decodeBase64(body.chapIdB64 ?? body["chap-id-b64"]),
        chapChallenge: body.chapChallenge ?? body["chap-challenge"] ?? decodeBase64(body.chapChallengeB64 ?? body["chap-challenge-b64"]),
      });

      return reply.status(201).send({
        id: lead.id,
        message: `Cadastro enviado com sucesso. Liberamos ${bonusMinutes} minuto(s) de internet como bonus.`,
        bonusAccess: { minutes: bonusMinutes, html },
      });
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/ixc/invoices/pix", async (request, reply) => {
    try {
      const body = ixcPixSchema.parse(request.body);
      const hotspot = await getIxcHotspot(body.hotspotSlug);
      if (!hotspot) {
        return reply.status(400).send({ error: "Integracao IXC nao configurada para este hotspot." });
      }

      const pix = await getIxcInvoicePix(ixcConfigFromHotspot(hotspot), body.invoiceId);
      const tempCode = randomIxcPaymentCode();
      const now = new Date();

      if (hotspot.mikrotik.ativo) {
        await createHotspotUser(hotspot.mikrotik, tempCode, tempCode, 4, hotspot.mikrotik.profilePadrao, "Hotspot IXC_PAGAMENTO");
      }

      await prisma.acesso.create({
        data: {
          tipo: LoginType.IXC,
          codigo: tempCode,
          mac: body.mac,
          ip: body.ip,
          loginEm: now,
          expiraEm: addMinutes(now, 4),
          status: AccessStatus.LIBERADO,
          hotspotId: hotspot.id,
          mikrotikId: hotspot.mikrotikId,
        },
      });

      const routerBody = normalizePortalLoginBody({ ...body, loginType: "ixc" });
      return {
        pix,
        tempAccess: {
          username: tempCode,
          password: tempCode,
          minutes: 4,
          html: finalLoginHtml(routerBody, tempCode, tempCode),
        },
      };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/ixc/recheck", async (request, reply) => {
    try {
      const rawBody = ixcRecheckSchema.parse(request.body);
      const body = normalizePortalLoginBody(rawBody);
      if (!body.cpf) {
        return reply.status(400).send({ error: "CPF ou CNPJ obrigatorio." });
      }

      const hotspot = await getIxcHotspot(body.hotspotSlug);
      if (!hotspot) {
        return reply.status(400).send({ error: "Integracao IXC nao configurada para este hotspot." });
      }

      const validation = await validateIxcLogin(ixcConfigFromHotspot(hotspot), body.cpf);
      if (!validation.allowed) {
        return reply.status(400).send({ error: validation.reason, code: validation.code });
      }

      const username = normalizeCpf(body.cpf);
      const password = randomPassword();
      const now = new Date();

      if (hotspot.mikrotik.ativo) {
        await createHotspotUser(
          hotspot.mikrotik,
          username,
          password,
          hotspot.integracaoTempoMinutos,
          hotspot.mikrotik.profilePadrao,
          "Hotspot IXC",
        );
      }

      await prisma.acesso.create({
        data: {
          tipo: LoginType.IXC,
          codigo: username,
          mac: body.mac,
          ip: body.ip,
          loginEm: now,
          expiraEm: addMinutes(now, hotspot.integracaoTempoMinutos),
          status: AccessStatus.LIBERADO,
          hotspotId: hotspot.id,
          mikrotikId: hotspot.mikrotikId,
        },
      });

      return reply.type("text/html").send(finalLoginHtml(body, username, password));
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/login", async (request, reply) => {
    try {
      const body: PortalLoginBody = normalizePortalLoginBody(request.body);
      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: body.hotspotSlug },
        include: { mikrotik: true, integracao: true },
      });

      if (!hotspot || !hotspot.ativo) {
        return reply.status(404).send({ error: "Hotspot nao encontrado." });
      }

      let username: string;
      let password: string;
      let minutes: number;
      let voucherId: string | null = null;
      let cpfLoginId: string | null = null;
      let accessCode: string;
      let accessType: LoginType;

      if (body.loginType === "voucher") {
        if (!hotspot.loginVoucher) {
          return reply.status(400).send({ error: "Login por voucher desativado neste hotspot." });
        }

        const codigo = body.codigo ?? body.voucher;
        if (!codigo) {
          return reply.status(400).send({ error: "Voucher obrigatorio." });
        }

        const voucher = await prisma.voucher.findFirst({
          where: { codigo, hotspotId: hotspot.id, usado: false },
        });

        if (!voucher) {
          return reply.status(400).send({ error: "Voucher indisponivel ou ja utilizado." });
        }

        username = voucher.codigo;
        password = randomPassword();
        minutes = voucher.tempoMinutos;
        voucherId = voucher.id;
        accessCode = voucher.codigo;
        accessType = LoginType.VOUCHER;
      } else if (body.loginType === "cpf") {
        if (!hotspot.loginCpf) {
          return reply.status(400).send({ error: "Login por CPF desativado neste hotspot." });
        }

        if (!body.cpf) {
          return reply.status(400).send({ error: "CPF obrigatorio." });
        }

        const cpf = normalizeCpf(body.cpf);
        const cpfLogin = await prisma.cpfLogin.findFirst({
          where: { cpf, hotspotId: hotspot.id, ativo: true },
        });

        if (!cpfLogin) {
          return reply.status(400).send({ error: "CPF nao autorizado para este hotspot." });
        }

        username = cpfLogin.cpf;
        password = randomPassword();
        minutes = cpfLogin.tempoMinutos;
        cpfLoginId = cpfLogin.id;
        accessCode = cpfLogin.cpf;
        accessType = LoginType.CPF;
      } else {
        if (!hotspot.loginIntegracao) {
          return reply.status(400).send({ error: "Login por integracao desativado neste hotspot." });
        }

        if (!hotspot.integracao || !hotspot.integracao.ativo) {
          return reply.status(400).send({ error: "Integracao nao configurada para este hotspot." });
        }

        if (hotspot.integracao.tipo !== "IXC") {
          return reply.status(400).send({ error: "Tipo de integracao nao suportado." });
        }

        if (!hotspot.integracao.baseUrl || !hotspot.integracao.usuario || !hotspot.integracao.senha) {
          return reply.status(400).send({ error: "Integracao IXC incompleta para este hotspot." });
        }

        if (!body.cpf) {
          return reply.status(400).send({ error: "CPF ou CNPJ obrigatorio." });
        }

        let ixcValidation;
        try {
          ixcValidation = await validateIxcLogin(
            {
              baseUrl: hotspot.integracao.baseUrl,
              usuario: hotspot.integracao.usuario,
              senha: hotspot.integracao.senha,
            },
            body.cpf,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha desconhecida na integracao IXC.";
          return reply.status(502).send({ error: `Nao foi possivel consultar a integracao IXC. ${message}` });
        }

        if (!ixcValidation.allowed) {
          return reply.status(400).send({
            error: ixcValidation.reason,
            code: ixcValidation.code,
            clienteId: "clienteId" in ixcValidation ? ixcValidation.clienteId : undefined,
          });
        }

        username = normalizeCpf(body.cpf);
        password = randomPassword();
        minutes = hotspot.integracaoTempoMinutos;
        accessCode = username;
        accessType = LoginType.IXC;
      }

      const html = buildFinalLoginHtml({
        linkLoginOnly: body.linkLoginOnly,
        linkLogin: body.linkLogin,
        username,
        password,
        dst: body.linkOrig,
        chapId: body.chapId ?? decodeBase64(body.chapIdB64),
        chapChallenge: body.chapChallenge ?? decodeBase64(body.chapChallengeB64),
      });

      const now = new Date();
      let voucherReserved = false;

      if (voucherId) {
        const reserved = await prisma.$transaction(async (tx) =>
          tx.voucher.updateMany({
            where: { id: voucherId, usado: false },
            data: { usado: true, mac: body.mac, ip: body.ip, usadoEm: now },
          }),
        );

        if (reserved.count !== 1) {
          throw new Error("Voucher indisponivel ou ja utilizado.");
        }

        voucherReserved = true;
      }

      try {
        if (hotspot.mikrotik.ativo) {
          if (voucherId) {
            await removeHotspotUser(hotspot.mikrotik, username);
          }
          await createHotspotUser(
            hotspot.mikrotik,
            username,
            password,
            minutes,
            hotspot.mikrotik.profilePadrao,
            `Hotspot ${accessType}`,
          );
        }
      } catch (error) {
        if (voucherReserved && voucherId) {
          await prisma.voucher.updateMany({
            where: { id: voucherId, usado: true },
            data: { usado: false, mac: null, ip: null, usadoEm: null },
          });
        }

        const message = error instanceof Error ? error.message : "Falha desconhecida ao comunicar com o MikroTik.";
        return reply.status(502).send({ error: message });
      }

      await prisma.$transaction(async (tx) => {
        if (cpfLoginId) {
          await tx.cpfLogin.update({
            where: { id: cpfLoginId },
            data: { usadoEm: now },
          });
        }

        await tx.acesso.create({
          data: {
            tipo: accessType,
            codigo: accessCode,
            mac: body.mac,
            ip: body.ip,
            loginEm: now,
            expiraEm: addMinutes(now, minutes),
            status: AccessStatus.LIBERADO,
            hotspotId: hotspot.id,
            mikrotikId: hotspot.mikrotikId,
            voucherId,
            cpfLoginId,
          },
        });
      });

      return reply.type("text/html").send(html);
    } catch (error) {
      if (error instanceof ZodError) {
        return sendZodError(reply, error);
      }

      if (error instanceof Error && error.message === "Voucher indisponivel ou ja utilizado.") {
        return reply.status(400).send({ error: error.message });
      }

      return sendCrudError(reply, error);
    }
  });
}
