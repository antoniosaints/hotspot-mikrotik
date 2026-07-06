import { prisma } from "../../db.js";
import {
  disconnectActiveHotspotClient,
  listActiveHotspotClients,
  removeHotspotUser,
  type MikrotikConnectionConfig,
} from "../../services/mikrotik.service.js";
import { AccessStatus } from "../../types.js";

const SWEEP_INTERVAL_MS = 45_000;

type SweepLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

type MikrotikRecord = MikrotikConnectionConfig & { ativo: boolean };

// Derruba a sessao ativa (se houver) e remove o usuario do MikroTik.
async function revokeRouterAccess(mikrotik: MikrotikRecord, username: string) {
  if (!mikrotik.ativo) {
    return;
  }

  const actives = await listActiveHotspotClients(mikrotik);
  for (const active of actives) {
    if (active.username === username && active.id) {
      await disconnectActiveHotspotClient(mikrotik, active.id);
    }
  }

  await removeHotspotUser(mikrotik, username);
}

// Compras PENDENTE cuja janela de pagamento venceu: corta o acesso e marca
// como EXPIRADA.
export async function expirePendingPurchases(log: SweepLogger) {
  const now = new Date();
  const pendentes = await prisma.compraAcesso.findMany({
    where: { status: "PENDENTE", janelaExpiraEm: { lt: now } },
    include: { hotspot: { include: { mikrotik: true } } },
  });

  for (const compra of pendentes) {
    try {
      if (compra.loginUsuario) {
        await revokeRouterAccess(compra.hotspot.mikrotik, compra.loginUsuario);
      }

      await prisma.compraAcesso.update({
        where: { id: compra.id },
        data: { status: "EXPIRADA", erroLiberacao: "Janela de pagamento expirada sem confirmacao." },
      });

      log.info({ compraId: compra.id }, "Compra expirada: janela de pagamento vencida");
    } catch (error) {
      log.warn({ err: error, compraId: compra.id }, "Falha ao expirar compra pendente (tentara novamente)");
    }
  }
}

// Compras LIBERADO cujo tempo comprado terminou: corta o acesso, marca a
// compra como ENCERRADA e o acesso como EXPIRADO.
export async function endExpiredPurchases(log: SweepLogger) {
  const now = new Date();
  const vencidas = await prisma.compraAcesso.findMany({
    where: { status: "LIBERADO", tempoExpiraEm: { lt: now } },
    include: { hotspot: { include: { mikrotik: true } } },
  });

  for (const compra of vencidas) {
    try {
      if (compra.loginUsuario) {
        await revokeRouterAccess(compra.hotspot.mikrotik, compra.loginUsuario);
      }

      await prisma.compraAcesso.update({
        where: { id: compra.id },
        data: { status: "ENCERRADA" },
      });

      if (compra.acessoId) {
        await prisma.acesso.update({
          where: { id: compra.acessoId },
          data: { status: AccessStatus.EXPIRADO },
        });
      }

      log.info({ compraId: compra.id }, "Compra encerrada: tempo comprado esgotado");
    } catch (error) {
      log.warn({ err: error, compraId: compra.id }, "Falha ao encerrar compra vencida (tentara novamente)");
    }
  }
}

export async function runExpirationSweep(log: SweepLogger) {
  await expirePendingPurchases(log);
  await endExpiredPurchases(log);
}

// Inicia o ciclo de expiracao (roda no boot e a cada SWEEP_INTERVAL_MS).
// Retorna a funcao de parada, usada no shutdown do servidor.
export function startExpirationSweep(log: SweepLogger): () => void {
  const execute = () => {
    void runExpirationSweep(log).catch((error) => {
      log.error({ err: error }, "Falha no ciclo de expiracao da bilheteria");
    });
  };

  execute();
  const timer = setInterval(execute, SWEEP_INTERVAL_MS);
  timer.unref?.();

  return () => clearInterval(timer);
}
