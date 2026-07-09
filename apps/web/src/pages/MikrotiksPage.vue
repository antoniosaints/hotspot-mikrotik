<template>
  <div class="space-y-4">
    <Alert v-if="connectionMessage" :variant="connectionOk ? 'default' : 'destructive'">
      {{ connectionMessage }}
    </Alert>

    <CrudPage
      title="Equipamentos"
      singular-title="MikroTik"
      description="Equipamentos de rede do sistema. Hoje: roteadores MikroTik usados para criar usuarios temporarios no Hotspot."
      endpoint="/mikrotiks"
      :columns="columns"
      :fields="fields"
    >
      <template #row-actions="{ item }">
        <Button
          size="icon"
          variant="ghost"
          :aria-label="`Testar conexao de ${String(item.nome ?? 'MikroTik')}`"
          :title="`Testar conexao de ${String(item.nome ?? 'MikroTik')}`"
          :disabled="testingId === item.id"
          @click="testConnection(item as Mikrotik)"
        >
          <Loader2 v-if="testingId === item.id" class="h-4 w-4 animate-spin text-blue-300" />
          <Wifi v-else class="h-4 w-4 text-blue-300" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          :aria-label="`Validar usuarios de ${String(item.nome ?? 'MikroTik')}`"
          :title="`Validar usuarios de ${String(item.nome ?? 'MikroTik')}`"
          @click="openUsersModal(item as Mikrotik)"
        >
          <Users class="h-4 w-4 text-emerald-300" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          :aria-label="`Configuracao de ${String(item.nome ?? 'MikroTik')}`"
          :title="`Configuracao de ${String(item.nome ?? 'MikroTik')}`"
          @click="openConfigModal(item as Mikrotik)"
        >
          <Settings2 class="h-4 w-4 text-amber-300" />
        </Button>
      </template>
    </CrudPage>

    <Dialog
      v-model:open="usersOpen"
      width-class="max-w-4xl"
      :title="selectedMikrotik ? `Usuarios em ${selectedMikrotik.nome}` : 'Usuarios do MikroTik'"
      description="Valide os usuarios hotspot existentes no roteador e remova entradas antigas quando necessario."
    >
      <Alert v-if="usersError" class="mb-4" variant="destructive">{{ usersError }}</Alert>
      <div v-if="usersLoading" class="py-10 text-center text-sm text-muted-foreground">Consultando usuarios no MikroTik...</div>
      <Table v-else>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Usuario</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Profile</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Tempo</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Comentario</th>
            <th class="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Acao</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="routerUsers.length === 0">
            <td colspan="5" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum usuario hotspot encontrado.</td>
          </tr>
          <tr v-for="user in routerUsers" :key="user.id">
            <td class="px-4 py-3 text-sm font-medium">{{ user.name || user.id }}</td>
            <td class="px-4 py-3 text-sm">{{ user.profile || "-" }}</td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ user.uptime || "0s" }} / {{ user.limitUptime || "-" }}</td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ user.comment || "-" }}</td>
            <td class="px-4 py-3 text-right">
              <Button size="sm" variant="destructive" :disabled="deletingUserId === user.id" @click="deleteRouterUser(user)">
                {{ deletingUserId === user.id ? "Apagando..." : "Apagar" }}
              </Button>
            </td>
          </tr>
        </tbody>
      </Table>
      <template #footer>
        <Button variant="outline" @click="usersOpen = false">Fechar</Button>
        <Button variant="secondary" :disabled="usersLoading || !selectedMikrotik" @click="loadRouterUsers">Atualizar</Button>
      </template>
    </Dialog>

    <Dialog
      v-model:open="configOpen"
      width-class="max-w-4xl"
      :title="selectedMikrotik ? `Configuracao de ${selectedMikrotik.nome}` : 'Configuracao MikroTik'"
      description="Baixe os arquivos do hotspot e confira os comandos principais para preparar o roteador."
    >
      <Alert v-if="configError" class="mb-4" variant="destructive">{{ configError }}</Alert>
      <div class="mb-4 flex flex-wrap gap-2">
        <Select v-model="selectedHotspotId" class="min-w-64" placeholder="Selecione o hotspot">
          <option v-for="hotspot in selectedMikrotikHotspots" :key="hotspot.id" :value="hotspot.id">{{ hotspot.nome }}</option>
        </Select>
        <Button v-for="file in hotspotFiles" :key="file" :disabled="!selectedHotspotId" variant="secondary" @click="downloadHotspotFile(file)">
          <Download class="h-4 w-4" />
          {{ file }}.html
        </Button>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <Card v-for="section in configSections" :key="section.title" :title="section.title" :description="section.description">
          <pre class="overflow-auto rounded-md bg-background/80 p-4 text-xs leading-6 text-blue-100"><code>{{ section.command }}</code></pre>
        </Card>
      </div>
      <template #footer>
        <Button variant="outline" @click="configOpen = false">Fechar</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Download, Loader2, Settings2, Users, Wifi } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Select from "@/components/ui/Select.vue";
import Table from "@/components/ui/Table.vue";
import CrudPage, { type CrudColumn, type CrudField } from "@/pages/CrudPage.vue";
import { api, ApiError, apiUrl, getToken, handleUnauthorized } from "@/services/api";
import type { Hotspot, Mikrotik } from "@/types/hotspot";

type ConnectionTestResponse = {
  ok: boolean;
  error?: string;
};

type RouterUser = {
  id: string;
  name: string;
  profile: string;
  uptime: string;
  limitUptime: string;
  comment: string;
  disabled: string;
};

const testingId = ref("");
const connectionMessage = ref("");
const connectionOk = ref(false);
const usersOpen = ref(false);
const usersLoading = ref(false);
const usersError = ref("");
const selectedMikrotik = ref<Mikrotik | null>(null);
const routerUsers = ref<RouterUser[]>([]);
const deletingUserId = ref("");
const hotspots = ref<Hotspot[]>([]);
const configOpen = ref(false);
const configError = ref("");
const selectedHotspotId = ref("");
const hotspotFiles = ["login", "alogin", "status", "logout"] as const;
type HotspotFile = (typeof hotspotFiles)[number];

const columns: CrudColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "host", label: "Host" },
  { key: "portaApi", label: "Porta" },
  { key: "profilePadrao", label: "User Profile" },
  { key: "ativo", label: "Status", type: "boolean" },
];

const fields: CrudField[] = [
  { key: "nome", label: "Nome", type: "text" },
  { key: "host", label: "Host", type: "text", placeholder: "192.168.88.1" },
  { key: "usuarioApi", label: "Usuario API", type: "text" },
  { key: "senhaApi", label: "Senha API", type: "password" },
  { key: "portaApi", label: "Porta API", type: "number", defaultValue: 8728 },
  { key: "timeoutApi", label: "Timeout API (ms)", type: "number", defaultValue: 5000 },
  { key: "profilePadrao", label: "Profile de usuario Hotspot", type: "text", defaultValue: "default" },
  { key: "ativo", label: "Ativo", type: "checkbox", defaultValue: true },
];

const selectedMikrotikHotspots = computed(() => hotspots.value.filter((hotspot) => hotspot.mikrotikId === selectedMikrotik.value?.id));
const selectedHotspot = computed(() => hotspots.value.find((hotspot) => hotspot.id === selectedHotspotId.value));
const portalUrl = computed(() => selectedHotspot.value?.portalUrl ?? "http://SEU-SERVIDOR:5173/portal/seu-hotspot");
const dnsName = computed(() => {
  try {
    return new URL(portalUrl.value).host;
  } catch {
    return "SEU-SERVIDOR";
  }
});
const configSections = computed(() => [
  {
    title: "1. Habilitar API",
    description: "Libere a porta usada pelo backend para criar usuarios temporarios.",
    command: `/ip service set api disabled=no port=8728
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Hotspot API backend"`,
  },
  {
    title: "2. Usuario para API",
    description: "Crie um usuario dedicado com permissao suficiente para hotspot user.",
    command: `/user group add name=hotspot-api policy=read,write,api,!local,!telnet,!ssh,!ftp,!reboot,!policy,!test,!winbox,!password,!web,!sniff,!sensitive,!romon
/user add name=hotspot-api password=SENHA_FORTE group=hotspot-api`,
  },
  {
    title: "3. Profile de login",
    description: "Use o User Profile no cadastro do MikroTik da plataforma.",
    command: `/ip hotspot profile set [find] login-by=http-chap,http-pap
/ip hotspot user profile add name=hotspot-temporario shared-users=1 keepalive-timeout=2m status-autorefresh=1m`,
  },
  {
    title: "4. Walled garden",
    description: "Permita o acesso ao servidor do portal antes da autenticacao.",
    command: `/ip hotspot walled-garden add dst-host=${dnsName.value} action=allow
/ip hotspot walled-garden ip add dst-host=${dnsName.value} action=accept
/ip hotspot walled-garden ip add dst-address=${dnsName.value} action=accept`,
  },
]);

async function testConnection(mikrotik: Mikrotik): Promise<void> {
  testingId.value = mikrotik.id;
  connectionMessage.value = "";
  connectionOk.value = false;

  try {
    const result = await api.post<ConnectionTestResponse>(`/mikrotiks/${mikrotik.id}/test`);
    connectionOk.value = result.ok;
    connectionMessage.value = result.ok
      ? `Conexao com ${mikrotik.nome} validada com sucesso.`
      : `Falha ao conectar em ${mikrotik.nome}: ${result.error ?? "erro desconhecido."}`;
  } catch (error) {
    connectionOk.value = false;
    connectionMessage.value =
      error instanceof ApiError ? `Falha ao testar ${mikrotik.nome}: ${error.message}` : `Falha ao testar ${mikrotik.nome}.`;
  } finally {
    testingId.value = "";
  }
}

async function openUsersModal(mikrotik: Mikrotik): Promise<void> {
  selectedMikrotik.value = mikrotik;
  usersOpen.value = true;
  await loadRouterUsers();
}

async function loadRouterUsers(): Promise<void> {
  if (!selectedMikrotik.value) return;

  usersLoading.value = true;
  usersError.value = "";
  try {
    const response = await api.get<{ users: RouterUser[] }>(`/mikrotiks/${selectedMikrotik.value.id}/users`);
    routerUsers.value = response.users;
  } catch (error) {
    usersError.value =
      error instanceof ApiError ? `Falha ao consultar usuarios: ${error.message}` : "Falha ao consultar usuarios no MikroTik.";
  } finally {
    usersLoading.value = false;
  }
}

async function deleteRouterUser(user: RouterUser): Promise<void> {
  if (!selectedMikrotik.value) return;
  if (!window.confirm(`Apagar usuario ${user.name || user.id} do MikroTik?`)) return;

  deletingUserId.value = user.id;
  usersError.value = "";
  try {
    await api.delete(`/mikrotiks/${selectedMikrotik.value.id}/users/${encodeURIComponent(user.id)}`);
    await loadRouterUsers();
  } catch (error) {
    usersError.value = error instanceof ApiError ? `Falha ao apagar usuario: ${error.message}` : "Falha ao apagar usuario.";
  } finally {
    deletingUserId.value = "";
  }
}

async function openConfigModal(mikrotik: Mikrotik): Promise<void> {
  selectedMikrotik.value = mikrotik;
  selectedHotspotId.value = selectedMikrotikHotspots.value[0]?.id ?? "";
  configError.value = "";
  configOpen.value = true;
}

async function downloadHotspotFile(file: HotspotFile): Promise<void> {
  if (!selectedHotspotId.value) return;
  configError.value = "";
  const path = `/hotspots/${selectedHotspotId.value}/${file}-html`;
  const token = getToken();
  const response = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(path);
    configError.value = text || `Nao foi possivel baixar o ${file}.html.`;
    return;
  }
  const blob = new Blob([text], { type: response.headers.get("content-type") || "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  hotspots.value = await api.get<Hotspot[]>("/hotspots");
});
</script>
