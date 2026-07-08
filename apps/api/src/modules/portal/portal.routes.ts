import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { getIxcInvoicePix, listCurrentMonthOpenInvoices, validateIxcLogin, type IxcConfig } from "../../services/ixc.service.js";
import { createHotspotUser, removeHotspotUser } from "../../services/mikrotik.service.js";
import { buildFinalLoginHtml } from "../../services/router-login.service.js";
import { AccessStatus, LoginType } from "../../types.js";
import { addMinutes, sendCrudError, sendZodError } from "../../utils/http.js";
import { normalizeCpf, normalizeVoucherCode } from "../../utils/normalization.js";
import { getConfig } from "../settings/settings.routes.js";
import { campanhaEstaAtiva } from "../campaigns/campaigns.routes.js";

type HotspotLgpdOverride = {
  lgpdModo: string;
  termosUso: string | null;
  politicaPrivacidade: string | null;
  lgpdConsentimentoTexto: string | null;
  exigirConsentimentoLgpd: boolean | null;
};

// Resolve os textos/exigencia efetivos de LGPD: hotspot em modo CUSTOM sobrescreve
// o global; caso contrario herda a Configuracao global.
function resolveLgpd(
  hotspot: HotspotLgpdOverride,
  config: Awaited<ReturnType<typeof getConfig>>,
) {
  const custom = hotspot.lgpdModo === "CUSTOM";
  return {
    exigir: hotspot.exigirConsentimentoLgpd ?? config.exigirConsentimento,
    versao: config.lgpdVersao,
    consentimentoTexto: (custom && hotspot.lgpdConsentimentoTexto) || config.lgpdConsentimentoTexto,
    termosUso: (custom && hotspot.termosUso) || config.termosUso,
    politicaPrivacidade: (custom && hotspot.politicaPrivacidade) || config.politicaPrivacidade,
  };
}

// Payload publico de campanha (sem campos internos de admin/segmentacao).
function toPortalCampanha(campanha: {
  id: string;
  tipo: string;
  momento: string;
  duracaoSegundos: number | null;
  permitePular: boolean;
  exibicao: string;
  ctaTexto: string | null;
  ctaUrl: string | null;
  imagemUrl: string | null;
  videoUrl: string | null;
  htmlConteudo: string | null;
  titulo: string | null;
  subtitulo: string | null;
  texto: string | null;
  corFundo: string | null;
  corTexto: string | null;
  blocos: string | null;
}) {
  return {
    id: campanha.id,
    tipo: campanha.tipo,
    momento: campanha.momento,
    duracaoSegundos: campanha.duracaoSegundos,
    permitePular: campanha.permitePular,
    exibicao: campanha.exibicao,
    ctaTexto: campanha.ctaTexto,
    ctaUrl: campanha.ctaUrl,
    imagemUrl: campanha.imagemUrl,
    videoUrl: campanha.videoUrl,
    htmlConteudo: campanha.htmlConteudo,
    titulo: campanha.titulo,
    subtitulo: campanha.subtitulo,
    texto: campanha.texto,
    corFundo: campanha.corFundo,
    corTexto: campanha.corTexto,
    blocos: campanha.blocos,
  };
}

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

  // O chap-challenge e binario. "latin1" preserva cada byte como um char
  // 0x00-0xFF (compativel com o hexMD5 do md5.js do MikroTik); "utf8"
  // corromperia bytes invalidos e geraria hash CHAP errado.
  return Buffer.from(value, "base64").toString("latin1");
}

// Prefere a versao base64 (transporte seguro em querystring/JSON) e usa o
// valor cru apenas como fallback, pois ele pode chegar corrompido do browser.
function chapValue(raw: string | null | undefined, b64: string | null | undefined) {
  return decodeBase64(b64) ?? raw ?? undefined;
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
    chapId: chapValue(body.chapId, body.chapIdB64),
    chapChallenge: chapValue(body.chapChallenge, body.chapChallengeB64),
  });
}

export async function portalRoutes(app: FastifyInstance) {
  // Resolve MikroTik + servidor hotspot (interface de origem) para o slug do
  // portal. Usado pelo login.html compartilhado, que envia $(server-name).
  app.get("/portal/resolve/:mikrotikId", async (request, reply) => {
    try {
      const params = z.object({ mikrotikId: z.string().min(1) }).parse(request.params);
      const query = z.object({ server: z.string().optional() }).parse(request.query);
      const server = query.server?.trim();
      // Variavel nao substituida pelo MikroTik (ex.: pagina aberta fora do
      // hotspot) chega literal como "$(server-name)".
      const validServer = server && !server.startsWith("$(") ? server : undefined;

      const hotspot =
        (validServer
          ? await prisma.hotspot.findFirst({
              where: { mikrotikId: params.mikrotikId, servidorHotspot: validServer, ativo: true },
              select: { slug: true },
            })
          : null) ??
        // Fallback: hotspot do MikroTik sem servidor definido, ou o mais antigo ativo.
        (await prisma.hotspot.findFirst({
          where: { mikrotikId: params.mikrotikId, servidorHotspot: null, ativo: true },
          select: { slug: true },
        })) ??
        (await prisma.hotspot.findFirst({
          where: { mikrotikId: params.mikrotikId, ativo: true },
          orderBy: { criadoEm: "asc" },
          select: { slug: true },
        }));

      if (!hotspot) {
        return reply.status(404).send({ error: "Nenhum hotspot ativo para este MikroTik." });
      }

      return { slug: hotspot.slug };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

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
          portalLogoUrl: true,
          portalTitulo: true,
          portalSubtitulo: true,
          portalRodape: true,
          portalCorFundo: true,
          portalCorFundoFim: true,
          portalCorTexto: true,
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
          lgpdModo: true,
          termosUso: true,
          politicaPrivacidade: true,
          lgpdConsentimentoTexto: true,
          exigirConsentimentoLgpd: true,
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

      const config = await getConfig();
      const lgpd = resolveLgpd(hotspot, config);
      // Remove os campos brutos de override do payload publico; o portal usa
      // apenas o bloco `lgpd` ja resolvido.
      const {
        lgpdModo: _lgpdModo,
        termosUso: _termosUso,
        politicaPrivacidade: _politicaPrivacidade,
        lgpdConsentimentoTexto: _lgpdConsentimentoTexto,
        exigirConsentimentoLgpd: _exigirConsentimentoLgpd,
        ...hotspotPublic
      } = hotspot;

      return {
        hotspot: hotspotPublic,
        lgpd,
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

  app.get("/portal/:slug/campanhas", async (request, reply) => {
    try {
      const params = slugParamsSchema.parse(request.params);
      const query = z
        .object({ momento: z.enum(["ANTES_LOGIN", "DEPOIS_LOGIN"]).optional() })
        .parse(request.query);

      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: params.slug },
        select: { id: true, ativo: true },
      });
      if (!hotspot || !hotspot.ativo) return [];

      const campanhas = await prisma.campanha.findMany({
        where: {
          ativo: true,
          ...(query.momento ? { momento: query.momento } : {}),
          OR: [{ todosHotspots: true }, { hotspots: { some: { id: hotspot.id } } }],
        },
        orderBy: [{ prioridade: "desc" }, { criadoEm: "desc" }],
      });

      const agora = new Date();
      return campanhas.filter((campanha) => campanhaEstaAtiva(campanha, agora)).map(toPortalCampanha);
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      throw error;
    }
  });

  app.post("/portal/consentimento", async (request, reply) => {
    try {
      const body = z
        .object({
          hotspotSlug: z.string().min(1),
          versaoTermos: z.string().min(1),
          mac: z.string().optional().nullable(),
          ip: z.string().optional().nullable(),
        })
        .parse(request.body);

      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: body.hotspotSlug },
        select: { id: true },
      });
      if (!hotspot) return reply.status(404).send({ error: "Hotspot nao encontrado." });

      await prisma.consentimentoLgpd.create({
        data: {
          hotspotId: hotspot.id,
          versaoTermos: body.versaoTermos,
          mac: body.mac ?? null,
          ip: body.ip ?? request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
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
          hotspot.servidorHotspot,
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
        chapId: chapValue(body.chapId ?? body["chap-id"], body.chapIdB64 ?? body["chap-id-b64"]),
        chapChallenge: chapValue(body.chapChallenge ?? body["chap-challenge"], body.chapChallengeB64 ?? body["chap-challenge-b64"]),
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
        await createHotspotUser(hotspot.mikrotik, tempCode, tempCode, 4, hotspot.mikrotik.profilePadrao, "Hotspot IXC_PAGAMENTO", hotspot.servidorHotspot);
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
          `Hotspot IXC - ${validation.nome}`,
          hotspot.servidorHotspot,
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
        password = voucher.codigo;
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
          request.log.error({ err: error }, "Falha na integracao IXC durante login do portal");
          // 503 (e nao 502/504): o Cloudflare intercepta 502/504 da origem e
          // devolve a pagina de erro dele sem headers CORS, escondendo a
          // mensagem real do portal.
          return reply.status(503).send({ error: `Nao foi possivel consultar a integracao IXC. ${message}` });
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
        chapId: chapValue(body.chapId, body.chapIdB64),
        chapChallenge: chapValue(body.chapChallenge, body.chapChallengeB64),
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
            hotspot.servidorHotspot,
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
        request.log.error({ err: error }, "Falha ao criar usuario hotspot no MikroTik durante login do portal");
        // 503 (e nao 502/504): o Cloudflare intercepta 502/504 da origem e
        // devolve a pagina de erro dele sem headers CORS.
        return reply.status(503).send({ error: message });
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
