import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";
import { AdminRole, requireAnyRole } from "../auth/permissions.js";

const askSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  integrationId: z.string().optional().nullable(),
});

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const SYSTEM_CONTEXT = `
Voce e o assistente de autoajuda do sistema Hotspot CAS. Responda em portugues do Brasil, de forma objetiva e operacional.
O sistema possui estes recursos principais:
- Dashboard com indicadores, graficos, acessos recentes, faturamento e clientes ativos.
- Locais para agrupar pontos de atendimento.
- Equipamentos MikroTik/RouterOS com API, profile padrao, servidores hotspot e usuarios ativos.
- Hotspots vinculados a local e equipamento, com portal, LGPD, login por voucher, CPF, IXC e compra online.
- Telas de cadastro para coletar dados antes do login ou em fluxos de contratacao.
- Campanhas exibidas antes ou depois do login no portal.
- Planos pagos e compra online via Mercado Pago Pix.
- Prospeccoes vindas de compras Pix e do fluxo Quero contratar.
- Dispositivos consolidados por MAC, com dados coletados e historico de conexoes.
- Vouchers e Logins CPF para liberacao manual de acesso.
- Apps: Mercado Pago para pagamentos, IXC Soft para ERP/login externo e Gemini para IA.
- Configuracoes para Termos, LGPD, consentimentos e manutencao de dados.
Nao invente credenciais, URLs ou dados do cliente. Quando depender de ambiente externo, indique onde configurar no sistema.
`;

export async function autohelpRoutes(app: FastifyInstance) {
  app.get(
    "/autoajuda/status",
    { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.MARKETING, AdminRole.SELLER, AdminRole.USER)] },
    async () => {
      const geminiConfigs = await prisma.integracao.findMany({
        where: { tipo: "GEMINI", ativo: true, token: { not: null } },
        orderBy: { criadoEm: "desc" },
        select: { id: true, nome: true, baseUrl: true },
      });

      return {
        geminiAvailable: geminiConfigs.length > 0,
        geminiConfigs: geminiConfigs.map((config) => ({
          id: config.id,
          nome: config.nome,
          modelo: config.baseUrl || "gemini-1.5-flash",
        })),
      };
    },
  );

  app.post(
    "/autoajuda/ask",
    { preHandler: [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.MARKETING, AdminRole.SELLER, AdminRole.USER)] },
    async (request, reply) => {
      const body = askSchema.parse(request.body);
      const where = body.integrationId
        ? { id: body.integrationId, tipo: "GEMINI", ativo: true }
        : { tipo: "GEMINI", ativo: true };

      const config = await prisma.integracao.findFirst({
        where,
        orderBy: { criadoEm: "desc" },
      });

      if (!config?.token) {
        return reply.status(400).send({ error: "Nenhuma configuracao Gemini ativa com API Key foi encontrada." });
      }

      const model = (config.baseUrl || "gemini-1.5-flash").trim();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${SYSTEM_CONTEXT}\n\nPergunta do usuario: ${body.question}` }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 700,
            },
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as GeminiResponse & { error?: { message?: string } };

      if (!response.ok) {
        const message = data.error?.message ?? `Gemini retornou HTTP ${response.status}.`;
        request.log.warn({ status: response.status, message }, "Falha ao consultar Gemini");
        return reply.status(502).send({ error: `Nao foi possivel consultar o Gemini. ${message}` });
      }

      const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
      if (!answer) {
        return reply.status(502).send({ error: "Gemini nao retornou uma resposta em texto." });
      }

      return { answer, source: "gemini", integrationId: config.id, integrationName: config.nome };
    },
  );
}
