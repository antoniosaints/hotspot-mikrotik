import { createRequire } from "node:module";

export type MikrotikConnectionConfig = {
  host: string;
  usuarioApi: string;
  senhaApi: string;
  portaApi: number;
  timeoutApi: number;
};

type RouterOsClientConstructor = new (config: {
  host: string;
  user: string;
  password: string;
  port: number;
  timeout: number;
}) => {
  connect?: () => Promise<RouterOsMenu>;
  close?: () => Promise<void>;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

type RouterOsMenu = {
  menu?: (path: string) => {
    add?: (data: Record<string, string>) => Promise<unknown>;
    remove?: (id?: string) => Promise<unknown>;
    get?: (query?: Record<string, string>) => Promise<Array<Record<string, unknown>>>;
    getOnly?: (query?: Record<string, string>) => Promise<Record<string, unknown> | null>;
  };
};

export type MikrotikActiveClient = {
  id: string;
  username: string;
  ip: string;
  mac: string;
  uptime: string;
  loginBy: string;
  server: string;
};

export type MikrotikHotspotUser = {
  id: string;
  name: string;
  profile: string;
  uptime: string;
  limitUptime: string;
  comment: string;
  disabled: string;
};

type RouterOsModule = {
  RouterOSClient?: RouterOsClientConstructor;
  default?: RouterOsClientConstructor;
  Channel?: {
    prototype?: {
      processPacket?: (packet: string[]) => unknown;
      __hotspotEmptyReplyPatch?: boolean;
    };
  };
};

const require = createRequire(import.meta.url);

export function installRouterOsEmptyReplyPatch(module: RouterOsModule): void {
  const channelPrototype = module.Channel?.prototype;
  if (!channelPrototype?.processPacket || channelPrototype.__hotspotEmptyReplyPatch) {
    return;
  }

  const originalProcessPacket = channelPrototype.processPacket;
  channelPrototype.processPacket = function processPacketWithEmptyReply(packet: string[]) {
    if (packet[0] === "!empty") {
      return undefined;
    }

    return originalProcessPacket.call(this, packet);
  };
  channelPrototype.__hotspotEmptyReplyPatch = true;
}

async function loadRouterOsClient(): Promise<RouterOsClientConstructor> {
  try {
    const module = require("routeros-client") as RouterOsModule;
    installRouterOsEmptyReplyPatch(module);
    const Client = module.RouterOSClient ?? module.default;

    if (!Client) {
      throw new Error("Biblioteca routeros-client carregada, mas cliente RouterOS nao foi encontrado.");
    }

    return Client;
  } catch (error) {
    if (error instanceof Error && error.message.includes("RouterOS")) {
      throw error;
    }

    throw new Error("Biblioteca RouterOS ausente. Execute pnpm install para instalar routeros-client.");
  }
}

function formatRouterOsError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha desconhecida ao comunicar com o MikroTik.";
  return `Falha na comunicacao com MikroTik ${message}`;
}

// A biblioteca node-routeros interpreta `timeout` em SEGUNDOS (ela propria
// multiplica por 1000). O campo `timeoutApi` do cadastro e em milissegundos,
// entao e preciso converter. Sem essa conversao, 5000 (ms) vira ~83 minutos de
// timeout real e o proxy reverso de producao responde 502 antes da API.
function timeoutApiToSeconds(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 5;
  }

  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

async function withClient<T>(config: MikrotikConnectionConfig, action: (client: RouterOsMenu) => Promise<T>) {
  const Client = await loadRouterOsClient();
  const timeoutSeconds = timeoutApiToSeconds(config.timeoutApi);
  const client = new Client({
    host: config.host,
    user: config.usuarioApi,
    password: config.senhaApi,
    port: config.portaApi,
    timeout: timeoutSeconds,
  });

  // O RouterOSClient e um EventEmitter que emite "error" de forma assincrona
  // (ex.: reset ou timeout de socket depois do connect). Sem um listener
  // registrado, o Node encerra o processo inteiro com ERR_UNHANDLED_ERROR,
  // derrubando a API em producao. O erro relevante continua chegando pela
  // rejeicao das promises; aqui apenas evitamos o crash.
  let lastEmittedError: unknown;
  client.on?.("error", (error) => {
    lastEmittedError = error;
  });

  // Garantia extra: nunca deixar a requisicao pendurada alem do timeout
  // configurado (senao o proxy reverso responde 502 sem headers CORS).
  const watchdogMs = timeoutSeconds * 1000 + 5000;
  let watchdogTimer: NodeJS.Timeout | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    watchdogTimer = setTimeout(() => {
      reject(new Error(`Tempo limite de ${timeoutSeconds}s excedido ao comunicar com o MikroTik ${config.host}:${config.portaApi}.`));
    }, watchdogMs);
    watchdogTimer.unref?.();
  });

  try {
    const run = async () => {
      const connectedClient = await client.connect?.();
      if (!connectedClient) {
        throw new Error("Cliente RouterOS nao retornou uma sessao API conectada.");
      }

      return action(connectedClient);
    };

    const work = run();
    // Evita unhandled rejection caso o watchdog vença a corrida.
    work.catch(() => {});

    return await Promise.race([work, watchdog]);
  } catch (error) {
    throw new Error(formatRouterOsError(error ?? lastEmittedError));
  } finally {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
    }

    try {
      await client.close?.();
    } catch {
      // Falha ao fechar a sessao nao deve mascarar o resultado da operacao.
    }
  }
}

export async function createHotspotUser(
  config: MikrotikConnectionConfig,
  username: string,
  password: string,
  minutes: number,
  profile: string,
  comment?: string,
): Promise<void> {
  await withClient(config, async (client) => {
    const users = client.menu?.("/ip/hotspot/user");
    if (!users?.add) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/user.add.");
    }

    await users.add({
      name: username,
      password,
      profile,
      "limit-uptime": `${minutes}m`,
      ...(comment ? { comment } : {}),
    });
  });
}

export async function removeHotspotUser(config: MikrotikConnectionConfig, username: string): Promise<void> {
  await withClient(config, async (client) => {
    const users = client.menu?.("/ip/hotspot/user");
    if (!users?.getOnly || !users.remove) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/user.getOnly/remove.");
    }

    const existingUser = await users.getOnly({ name: username });
    if (!existingUser) {
      return;
    }

    const id = existingUser.id ?? existingUser[".id"];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Usuario hotspot encontrado sem .id para remocao.");
    }

    await users.remove(id);
  });
}

export async function removeHotspotUserById(config: MikrotikConnectionConfig, id: string): Promise<void> {
  await withClient(config, async (client) => {
    const users = client.menu?.("/ip/hotspot/user");
    if (!users?.remove) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/user.remove.");
    }

    await users.remove(id);
  });
}

export async function listHotspotUsers(config: MikrotikConnectionConfig): Promise<MikrotikHotspotUser[]> {
  return withClient(config, async (client) => {
    const users = client.menu?.("/ip/hotspot/user");
    if (!users?.get) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/user.get.");
    }

    const rows = await users.get();
    return rows.map((row) => ({
      id: valueAsString(row, "id", ".id"),
      name: valueAsString(row, "name"),
      profile: valueAsString(row, "profile"),
      uptime: valueAsString(row, "uptime"),
      limitUptime: valueAsString(row, "limitUptime", "limit-uptime"),
      comment: valueAsString(row, "comment"),
      disabled: valueAsString(row, "disabled"),
    }));
  });
}

function valueAsString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

export async function listActiveHotspotClients(config: MikrotikConnectionConfig): Promise<MikrotikActiveClient[]> {
  return withClient(config, async (client) => {
    const active = client.menu?.("/ip/hotspot/active");
    if (!active?.get) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/active.get.");
    }

    const rows = await active.get();
    return rows.map((row) => ({
      id: valueAsString(row, "id", ".id"),
      username: valueAsString(row, "user", "username"),
      ip: valueAsString(row, "address", "ip"),
      mac: valueAsString(row, "macAddress", "mac-address", "mac"),
      uptime: valueAsString(row, "uptime"),
      loginBy: valueAsString(row, "loginBy", "login-by"),
      server: valueAsString(row, "server"),
    }));
  });
}

export async function disconnectActiveHotspotClient(config: MikrotikConnectionConfig, activeId: string): Promise<void> {
  await withClient(config, async (client) => {
    const active = client.menu?.("/ip/hotspot/active");
    if (!active?.remove) {
      throw new Error("Cliente RouterOS nao expoe /ip/hotspot/active.remove.");
    }

    await active.remove(activeId);
  });
}

export async function testConnection(config: MikrotikConnectionConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await withClient(config, async (client) => {
      const identity = client.menu?.("/system/identity");
      if (!identity?.getOnly) {
        throw new Error("Cliente RouterOS nao expoe /system/identity.getOnly.");
      }

      await identity.getOnly();
      return true;
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha desconhecida ao testar conexao MikroTik.",
    };
  }
}
