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

async function withClient<T>(config: MikrotikConnectionConfig, action: (client: RouterOsMenu) => Promise<T>) {
  const Client = await loadRouterOsClient();
  const client = new Client({
    host: config.host,
    user: config.usuarioApi,
    password: config.senhaApi,
    port: config.portaApi,
    timeout: config.timeoutApi,
  });

  try {
    const connectedClient = await client.connect?.();
    if (!connectedClient) {
      throw new Error("Cliente RouterOS nao retornou uma sessao API conectada.");
    }

    return await action(connectedClient);
  } catch (error) {
    throw new Error(formatRouterOsError(error));
  } finally {
    await client.close?.();
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
