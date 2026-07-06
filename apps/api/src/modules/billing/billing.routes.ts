import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { buildFinalLoginHtml } from "../../services/router-login.service.js";
import { createHotspotUser } from "../../services/mikrotik.service.js";
import { AccessStatus, LoginType } from "../../types.js";
import { addMinutes, sendCrudError, sendZodError } from "../../utils/http.js";
import { buildTicketCredentials, hasProspectData, normalizeBuyerFields, randomTicketCode } from "./billing.service.js";
import { createPixPayment, getPayment, isApprovedPayment } from "./payment.service.js";

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().email().optional().nullable(),
);

const createPurchaseSchema = z.object({
  hotspotSlug: z.string().min(1),
  planoId: z.string().min(1).optional().nullable(),
  personalizado: z.boolean().optional(),
  tempoMinutos: z.number().int().positive().optional(),
  nome: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: optionalEmailSchema,
  cpf: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  mac: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
});

const purchaseParamsSchema = z.object({ id: z.string().min(1) });

const routerLoginSchema = z.object({
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

function decodeBase64(value: string | null | undefined) {
  if (!value) return undefined;
  // "latin1" preserva os bytes binarios do chap-challenge (ver portal.routes).
  return Buffer.from(value, "base64").toString("latin1");
}

// Prefere a versao base64 (transporte seguro) e usa o valor cru como fallback.
function chapValue(raw: string | null | undefined, b64: string | null | undefined) {
  return decodeBase64(b64) ?? raw ?? undefined;
}

function normalizeRouterLogin(input: unknown) {
  const body = routerLoginSchema.parse(input);
  return {
    linkLogin: body.linkLogin ?? body["link-login"],
    linkLoginOnly: body.linkLoginOnly ?? body["link-login-only"],
    linkOrig: body.linkOrig ?? body["link-orig"],
    chapId: body.chapId ?? body["chap-id"],
    chapChallenge: body.chapChallenge ?? body["chap-challenge"],
    chapIdB64: body.chapIdB64 ?? body["chap-id-b64"],
    chapChallengeB64: body.chapChallengeB64 ?? body["chap-challenge-b64"],
  };
}

function publicBaseUrl(request: { protocol: string; hostname: string }) {
  return `${request.protocol}://${request.hostname}`;
}

function randomTempPaymentCode() {
  return `PAY${randomTicketCode().replace(/[^A-Z0-9]/gi, "").slice(0, 9).toUpperCase()}`;
}

function isValidCustomStep(minutes: number, min: number, step: number) {
  return (minutes - min) % step === 0;
}

async function releasePurchase(compraId: string) {
  const compra = await prisma.compraAcesso.findUnique({
    where: { id: compraId },
    include: { hotspot: { include: { mikrotik: true } }, plano: true },
  });

  if (!compra || compra.status === "LIBERADO") {
    return compra;
  }

  const purchaseMinutes = compra.tempoMinutos ?? compra.plano?.tempoMinutos;
  if (!purchaseMinutes || purchaseMinutes <= 0) {
    return prisma.compraAcesso.update({
      where: { id: compra.id },
      data: { status: "FALHA_LIBERACAO", erroLiberacao: "Tempo da compra nao encontrado." },
    });
  }

  const credentials = buildTicketCredentials(
    { nome: compra.nome, telefone: compra.telefone, email: compra.email, cpf: compra.cpf, endereco: compra.endereco },
    randomTicketCode,
  );
  const now = new Date();

  try {
    if (compra.hotspot.mikrotik.ativo) {
      await createHotspotUser(
        compra.hotspot.mikrotik,
        credentials.username,
        credentials.password,
        purchaseMinutes,
        compra.hotspot.mikrotik.profilePadrao,
        "Hotspot COMPRA",
      );
    }

    const acesso = await prisma.acesso.create({
      data: {
        tipo: LoginType.COMPRA,
        codigo: credentials.username,
        mac: compra.mac,
        ip: compra.ip,
        loginEm: now,
        expiraEm: addMinutes(now, purchaseMinutes),
        status: AccessStatus.LIBERADO,
        hotspotId: compra.hotspotId,
        mikrotikId: compra.hotspot.mikrotikId,
      },
    });

    return prisma.compraAcesso.update({
      where: { id: compra.id },
      data: {
        status: "LIBERADO",
        loginUsuario: credentials.username,
        loginSenha: credentials.password,
        liberadoEm: now,
        acessoId: acesso.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao liberar acesso.";
    return prisma.compraAcesso.update({
      where: { id: compra.id },
      data: { status: "FALHA_LIBERACAO", erroLiberacao: message },
    });
  }
}

export async function billingRoutes(app: FastifyInstance) {
  app.post("/portal/purchases", async (request, reply) => {
    try {
      const body = createPurchaseSchema.parse(request.body);
      const hotspot = await prisma.hotspot.findUnique({
        where: { slug: body.hotspotSlug },
        include: {
          pagamentoIntegracao: true,
          planos: { where: { id: body.planoId ?? "__custom__", ativo: true }, take: 1 },
        },
      });

      if (!hotspot || !hotspot.ativo || !hotspot.compraOnline) {
        return reply.status(400).send({ error: "Compra de acesso indisponivel neste hotspot." });
      }

      if (!hotspot.pagamentoIntegracao || !hotspot.pagamentoIntegracao.ativo || hotspot.pagamentoIntegracao.tipo !== "MERCADO_PAGO") {
        return reply.status(400).send({ error: "Integracao de pagamento nao configurada para este hotspot." });
      }

      if (!hotspot.pagamentoIntegracao.token) {
        return reply.status(400).send({ error: "Token do Mercado Pago nao configurado." });
      }

      const plano = body.planoId ? hotspot.planos[0] : null;
      const isCustomPurchase = !plano && body.personalizado === true;
      if (body.planoId && !plano) {
        return reply.status(400).send({ error: "Plano indisponivel neste hotspot." });
      }

      if (!plano && !isCustomPurchase) {
        return reply.status(400).send({ error: "Selecione um plano ou tempo personalizado para comprar acesso." });
      }

      let purchaseName = plano?.nome ?? "Acesso personalizado";
      let purchaseMinutes = plano?.tempoMinutos ?? 0;
      let purchaseValue = plano?.valorCentavos ?? 0;

      if (isCustomPurchase) {
        const customMin = hotspot.tempoPersonalizadoMinimo;
        const customMax = hotspot.tempoPersonalizadoMaximo;
        const customStep = hotspot.tempoPersonalizadoPasso;
        const customValue = hotspot.valorMinutoCentavos ?? 0;
        const requestedMinutes = body.tempoMinutos ?? 0;

        if (!hotspot.compraPersonalizada || customValue <= 0) {
          return reply.status(400).send({ error: "Compra personalizada indisponivel neste hotspot." });
        }

        if (customMax < customMin || customStep <= 0) {
          return reply.status(400).send({ error: "Configuracao de tempo personalizado invalida." });
        }

        if (requestedMinutes < customMin || requestedMinutes > customMax || !isValidCustomStep(requestedMinutes, customMin, customStep)) {
          return reply.status(400).send({ error: "Tempo personalizado fora das opcoes permitidas." });
        }

        if (!body.email) {
          return reply.status(400).send({ error: "Email obrigatorio para gerar o PIX da compra personalizada." });
        }

        purchaseMinutes = requestedMinutes;
        purchaseValue = requestedMinutes * customValue;
        purchaseName = `Acesso personalizado ${requestedMinutes} min`;
      }

      const buyer = normalizeBuyerFields({
        nome: plano?.coletarNome ? body.nome : null,
        telefone: plano?.coletarTelefone ? body.telefone : null,
        email: plano?.coletarEmail || isCustomPurchase ? body.email : null,
        cpf: plano?.coletarCpf ? body.cpf : null,
        endereco: plano?.coletarEndereco ? body.endereco : null,
      });

      const compra = await prisma.compraAcesso.create({
        data: {
          status: "PENDENTE",
          valorCentavos: purchaseValue,
          tempoMinutos: purchaseMinutes,
          nome: buyer.nome,
          telefone: buyer.telefone,
          email: buyer.email,
          cpf: buyer.cpf,
          endereco: buyer.endereco,
          mac: body.mac,
          ip: body.ip,
          hotspotId: hotspot.id,
          planoId: plano?.id,
          pagamentoIntegracaoId: hotspot.pagamentoIntegracao.id,
        },
      });

      const payment = await createPixPayment(
        { accessToken: hotspot.pagamentoIntegracao.token, webhookSecret: hotspot.pagamentoIntegracao.chaveWebhook },
        {
          amountCentavos: purchaseValue,
          description: `${purchaseName} - ${hotspot.nome}`,
          payerEmail: buyer.email,
          externalReference: compra.id,
          notificationUrl: `${publicBaseUrl(request)}/api/webhooks/mercado-pago`,
        },
      );

      await prisma.compraAcesso.update({
        where: { id: compra.id },
        data: { mercadoPagoPaymentId: payment.id, mercadoPagoStatus: payment.status },
      });

      return reply.status(201).send({
        id: compra.id,
        status: "PENDENTE",
        hasProspectData: hasProspectData(buyer),
        payment: {
          id: payment.id,
          status: payment.status,
          qrCode: payment.qrCode,
          qrCodeBase64: payment.qrCodeBase64,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.get("/portal/purchases/:id/status", async (request, reply) => {
    try {
      const params = purchaseParamsSchema.parse(request.params);
      const compra = await prisma.compraAcesso.findUnique({
        where: { id: params.id },
        select: { id: true, status: true, erroLiberacao: true, loginUsuario: true },
      });

      if (!compra) return reply.status(404).send({ error: "Compra nao encontrada." });
      return compra;
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/purchases/:id/temp-access", async (request, reply) => {
    try {
      const params = purchaseParamsSchema.parse(request.params);
      const body = normalizeRouterLogin(request.body);
      const compra = await prisma.compraAcesso.findUnique({
        where: { id: params.id },
        include: { hotspot: { include: { mikrotik: true } } },
      });

      if (!compra) {
        return reply.status(404).send({ error: "Compra nao encontrada." });
      }

      const tempCode = randomTempPaymentCode();
      const now = new Date();

      if (compra.hotspot.mikrotik.ativo) {
        await createHotspotUser(
          compra.hotspot.mikrotik,
          tempCode,
          tempCode,
          4,
          compra.hotspot.mikrotik.profilePadrao,
          "Hotspot COMPRA_PAGAMENTO",
        );
      }

      await prisma.acesso.create({
        data: {
          tipo: LoginType.COMPRA,
          codigo: tempCode,
          mac: compra.mac,
          ip: compra.ip,
          loginEm: now,
          expiraEm: addMinutes(now, 4),
          status: AccessStatus.LIBERADO,
          hotspotId: compra.hotspotId,
          mikrotikId: compra.hotspot.mikrotikId,
        },
      });

      const html = buildFinalLoginHtml({
        linkLoginOnly: body.linkLoginOnly,
        linkLogin: body.linkLogin,
        username: tempCode,
        password: tempCode,
        dst: body.linkOrig,
        chapId: chapValue(body.chapId, body.chapIdB64),
        chapChallenge: chapValue(body.chapChallenge, body.chapChallengeB64),
      });

      return reply.type("text/html").send(html);
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/portal/purchases/:id/final-login", async (request, reply) => {
    try {
      const params = purchaseParamsSchema.parse(request.params);
      const body = normalizeRouterLogin(request.body);
      const compra = await prisma.compraAcesso.findUnique({ where: { id: params.id } });

      if (!compra || compra.status !== "LIBERADO" || !compra.loginUsuario || !compra.loginSenha) {
        return reply.status(400).send({ error: "Compra ainda nao liberada." });
      }

      const html = buildFinalLoginHtml({
        linkLoginOnly: body.linkLoginOnly,
        linkLogin: body.linkLogin,
        username: compra.loginUsuario,
        password: compra.loginSenha,
        dst: body.linkOrig,
        chapId: chapValue(body.chapId, body.chapIdB64),
        chapChallenge: chapValue(body.chapChallenge, body.chapChallengeB64),
      });

      return reply.type("text/html").send(html);
    } catch (error) {
      if (error instanceof ZodError) return sendZodError(reply, error);
      return sendCrudError(reply, error);
    }
  });

  app.post("/webhooks/mercado-pago", async (request, reply) => {
    try {
      const body = request.body as { data?: { id?: string | number }; id?: string | number };
      const paymentId = String(body.data?.id ?? body.id ?? "");
      if (!paymentId) return reply.status(200).send({ ok: true });

      const compra = await prisma.compraAcesso.findUnique({
        where: { mercadoPagoPaymentId: paymentId },
        include: { pagamentoIntegracao: true },
      });

      if (!compra?.pagamentoIntegracao?.token) return reply.status(200).send({ ok: true });

      const payment = await getPayment({ accessToken: compra.pagamentoIntegracao.token }, paymentId);
      if (payment.externalReference !== compra.id) return reply.status(200).send({ ok: true });

      await prisma.compraAcesso.update({
        where: { id: compra.id },
        data: {
          mercadoPagoStatus: payment.status,
          ...(isApprovedPayment(payment) ? { status: "PAGO", pagoEm: new Date() } : {}),
        },
      });

      if (isApprovedPayment(payment)) {
        await releasePurchase(compra.id);
      }

      return reply.send({ ok: true });
    } catch (error) {
      app.log.error(error);
      return reply.status(200).send({ ok: true });
    }
  });
}
