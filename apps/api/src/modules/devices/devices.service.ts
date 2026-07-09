import { prisma } from "../../db.js";
import { listActiveHotspotClients } from "../../services/mikrotik.service.js";
import { normalizeMac } from "../../utils/normalization.js";

// Campos pessoais que uma conexao pode trazer. Cada login preenche apenas o que
// tem: cadastro traz tudo, CPF/IXC trazem nome/cpf/telefone, voucher traz nada.
export type DispositivoDados = {
  nome?: string | null;
  email?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  cep?: string | null;
};

type RegistrarConexaoInput = {
  mac?: string | null;
  ip?: string | null;
  tipo?: string | null;
  hotspotId?: string | null;
  dados?: DispositivoDados;
};

// Mantem apenas os campos com valor real (string nao vazia). Assim uma conexao
// sem dados (voucher) nunca sobrescreve os dados ja preenchidos por outra forma.
function limparDados(dados: DispositivoDados | undefined) {
  const resultado: Record<string, string> = {};
  if (!dados) return resultado;

  for (const [chave, valor] of Object.entries(dados)) {
    if (typeof valor === "string" && valor.trim().length > 0) {
      resultado[chave] = valor.trim();
    }
  }

  return resultado;
}

// Atualiza (ou cria) o dispositivo do MAC a cada conexao. Best-effort: qualquer
// falha aqui e apenas logada e nunca interrompe o fluxo de login do portal.
export async function registrarConexaoDispositivo(input: RegistrarConexaoInput): Promise<void> {
  const mac = normalizeMac(input.mac);
  if (!mac) return;

  const dados = limparDados(input.dados);
  const agora = new Date();
  const ip = input.ip?.trim() || null;
  const tipo = input.tipo?.trim() || null;
  const hotspotId = input.hotspotId ?? null;

  try {
    await prisma.dispositivo.upsert({
      where: { mac },
      create: {
        mac,
        ...dados,
        ...(ip ? { ultimoIp: ip } : {}),
        ...(tipo ? { ultimoTipo: tipo } : {}),
        ...(hotspotId ? { ultimoHotspotId: hotspotId } : {}),
        ultimaConexao: agora,
        totalConexoes: 1,
      },
      update: {
        ...dados,
        ...(ip ? { ultimoIp: ip } : {}),
        ...(tipo ? { ultimoTipo: tipo } : {}),
        ...(hotspotId ? { ultimoHotspotId: hotspotId } : {}),
        ultimaConexao: agora,
        totalConexoes: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("Falha ao registrar conexao do dispositivo", { mac, error });
  }
}

// Marca que o dispositivo aceitou os termos (consentimento LGPD). Nao conta como
// conexao: o aceite acontece antes/junto do login e tem endpoint proprio.
export async function registrarConsentimentoDispositivo(input: { mac?: string | null; ip?: string | null }): Promise<void> {
  const mac = normalizeMac(input.mac);
  if (!mac) return;

  const agora = new Date();
  const ip = input.ip?.trim() || null;

  try {
    await prisma.dispositivo.upsert({
      where: { mac },
      create: {
        mac,
        aceitouTermos: true,
        aceitouTermosEm: agora,
        ...(ip ? { ultimoIp: ip } : {}),
      },
      update: {
        aceitouTermos: true,
        aceitouTermosEm: agora,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar consentimento do dispositivo", { mac, error });
  }
}

// Lista, em uma unica varredura dos MikroTiks ativos, todos os MACs online
// agora (normalizados). Usado para marcar a coluna "Online" da tabela sem
// consultar o roteador por linha. Best-effort: se um MikroTik falhar, os demais
// continuam e o primeiro erro e devolvido para aviso na UI.
export async function listarMacsOnline(): Promise<{ macs: string[]; erro: string | null }> {
  const mikrotiks = await prisma.mikrotik.findMany({ where: { ativo: true } });

  const macs = new Set<string>();
  let erro: string | null = null;

  for (const mikrotik of mikrotiks) {
    try {
      const clients = await listActiveHotspotClients(mikrotik);
      for (const client of clients) {
        const mac = normalizeMac(client.mac);
        if (mac) macs.add(mac);
      }
    } catch (error) {
      erro = erro ?? (error instanceof Error ? error.message : "Falha ao consultar clientes ativos.");
    }
  }

  return { macs: [...macs], erro };
}

export type SessaoAtivaDispositivo = {
  mikrotikId: string;
  mikrotikNome: string;
  activeId: string;
  username: string;
  ip: string;
  uptime: string;
  server: string;
  hotspotNome: string;
};

// Procura o MAC entre os clientes ativos de todos os MikroTiks ativos (consulta
// ao vivo). Retorna as sessoes encontradas para permitir a desconexao manual.
export async function buscarSessoesAtivasPorMac(
  mac: string,
): Promise<{ sessoes: SessaoAtivaDispositivo[]; erro: string | null }> {
  const alvo = normalizeMac(mac);
  if (!alvo) return { sessoes: [], erro: null };

  const mikrotiks = await prisma.mikrotik.findMany({
    where: { ativo: true },
    include: { hotspots: { select: { nome: true, servidorHotspot: true } } },
  });

  const sessoes: SessaoAtivaDispositivo[] = [];
  let erro: string | null = null;

  for (const mikrotik of mikrotiks) {
    const hotspotPorServidor = new Map(
      mikrotik.hotspots
        .filter((hotspot) => hotspot.servidorHotspot)
        .map((hotspot) => [hotspot.servidorHotspot as string, hotspot]),
    );

    try {
      const clients = await listActiveHotspotClients(mikrotik);
      for (const client of clients) {
        if (normalizeMac(client.mac) !== alvo) continue;
        const hotspot = hotspotPorServidor.get(client.server) ?? mikrotik.hotspots[0];
        sessoes.push({
          mikrotikId: mikrotik.id,
          mikrotikNome: mikrotik.nome,
          activeId: client.id,
          username: client.username,
          ip: client.ip,
          uptime: client.uptime,
          server: client.server,
          hotspotNome: hotspot?.nome ?? "-",
        });
      }
    } catch (error) {
      // Guarda o primeiro erro para avisar na UI, mas segue consultando os demais.
      erro = erro ?? (error instanceof Error ? error.message : "Falha ao consultar clientes ativos.");
    }
  }

  return { sessoes, erro };
}
