<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Controle</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Dispositivos</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Cada aparelho identificado pelo MAC. Os dados sao preenchidos e atualizados a cada conexao, em qualquer forma de login.
        </p>
      </div>
      <Button variant="secondary" @click="loadItems">
        <RefreshCw class="h-4 w-4" />
        Recarregar
      </Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>
    <p v-if="onlineError" class="text-xs text-amber-500">
      Status "Online" indisponivel no momento: {{ onlineError }}
    </p>

    <DataTableControls
      v-model:search="searchTerm"
      v-model:page="currentPage"
      v-model:page-size="pageSize"
      :total="items.length"
      :filtered-total="filteredItems.length"
      :total-pages="totalPages"
    />

    <div>
      <Table>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Online</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Nome</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Email</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">CPF</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">MAC</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Contato</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Cidade</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Termos</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Ultima conexao</th>
            <th class="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Acoes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="filteredItems.length === 0">
            <td colspan="10" class="px-4 py-10 text-center text-sm text-muted-foreground">
              {{ items.length === 0 ? "Nenhum dispositivo registrado ainda." : "Nenhum dispositivo encontrado para a busca." }}
            </td>
          </tr>
          <tr v-for="item in paginatedItems" :key="item.id" :class="onlineMacs.has(item.mac) ? 'bg-emerald-500/5' : ''">
            <td class="px-4 py-3">
              <span
                v-if="onlineMacs.has(item.mac)"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500"
              >
                <span class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px] shadow-emerald-500/70" />
                Online
              </span>
              <span v-else-if="onlineLoading" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40" />
                ...
              </span>
              <span v-else-if="onlineError" class="text-xs text-muted-foreground">-</span>
              <span v-else class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="h-2 w-2 rounded-full bg-muted-foreground/30" />
                Offline
              </span>
            </td>
            <td class="px-4 py-3 text-sm">
              <div class="font-medium">{{ item.nome ?? "-" }}</div>
              <div class="text-xs text-muted-foreground">{{ item.ultimoHotspot?.nome ?? "-" }}</div>
            </td>
            <td class="px-4 py-3 text-sm">{{ item.email ?? "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.cpf ?? "-" }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ item.mac }}</td>
            <td class="px-4 py-3 text-sm">{{ [item.telefone, item.whatsapp].filter(Boolean).join(" / ") || "-" }}</td>
            <td class="px-4 py-3 text-sm">{{ item.cidade ?? "-" }}</td>
            <td class="px-4 py-3">
              <Badge :variant="item.aceitouTermos ? 'default' : 'outline'">
                {{ item.aceitouTermos ? "Aceitou" : "Nao" }}
              </Badge>
            </td>
            <td class="px-4 py-3 text-sm">{{ formatDate(item.ultimaConexao) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="secondary" @click="openDetails(item)">Detalhes</Button>
                <Button v-if="canManage" size="sm" variant="outline" @click="openEdit(item)">Editar</Button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  </div>

  <!-- Editar dados do dispositivo -->
  <Dialog v-model:open="editOpen" title="Editar dispositivo" :description="editing?.mac">
    <form id="device-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveEdit">
      <div>
        <Label for="nome">Nome</Label>
        <Input id="nome" v-model="form.nome" class="mt-2" />
      </div>
      <div>
        <Label for="email">Email</Label>
        <Input id="email" v-model="form.email" class="mt-2" type="email" />
      </div>
      <div>
        <Label for="cpf">CPF</Label>
        <Input id="cpf" v-model="form.cpf" class="mt-2" />
      </div>
      <div>
        <Label for="telefone">Telefone</Label>
        <Input id="telefone" v-model="form.telefone" class="mt-2" />
      </div>
      <div>
        <Label for="whatsapp">WhatsApp</Label>
        <Input id="whatsapp" v-model="form.whatsapp" class="mt-2" />
      </div>
      <div>
        <Label for="cep">CEP</Label>
        <Input id="cep" v-model="form.cep" class="mt-2" />
      </div>
      <div class="sm:col-span-2">
        <Label for="endereco">Endereco</Label>
        <Input id="endereco" v-model="form.endereco" class="mt-2" />
      </div>
      <div>
        <Label for="cidade">Cidade</Label>
        <Input id="cidade" v-model="form.cidade" class="mt-2" />
      </div>
      <div class="flex items-end">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.aceitouTermos" type="checkbox" class="h-4 w-4 rounded border-border" />
          Aceitou os termos
        </label>
      </div>
    </form>
    <template #footer>
      <Button variant="outline" @click="editOpen = false">Cancelar</Button>
      <Button type="submit" form="device-form" :disabled="saving">{{ saving ? "Salvando..." : "Salvar" }}</Button>
    </template>
  </Dialog>

  <!-- Detalhes: dados, sessoes ativas e log de conexoes -->
  <Dialog v-model:open="detailsOpen" title="Detalhes do dispositivo" :description="details?.dispositivo.mac" width-class="max-w-3xl">
    <div v-if="detailsLoading" class="py-10 text-center text-sm text-muted-foreground">Carregando detalhes...</div>
    <div v-else-if="details" class="space-y-6">
      <Alert v-if="detailsError" variant="destructive">{{ detailsError }}</Alert>

      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="campo in infoFields" :key="campo.label">
          <p class="text-xs uppercase tracking-[0.12em] text-muted-foreground">{{ campo.label }}</p>
          <p class="text-sm">{{ campo.value }}</p>
        </div>
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Sessoes ativas</h3>
          <Badge :variant="details.sessoesAtivas.length ? 'default' : 'outline'">
            {{ details.sessoesAtivas.length }} online
          </Badge>
        </div>
        <Alert v-if="details.sessoesErro" variant="destructive" class="mb-2">{{ details.sessoesErro }}</Alert>
        <p v-if="details.sessoesAtivas.length === 0 && !details.sessoesErro" class="text-sm text-muted-foreground">
          O dispositivo nao esta conectado em nenhum hotspot no momento.
        </p>
        <div v-else class="space-y-2">
          <div
            v-for="sessao in details.sessoesAtivas"
            :key="sessao.activeId + sessao.mikrotikId"
            class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
          >
            <div class="text-sm">
              <div class="font-medium">{{ sessao.hotspotNome }} · {{ sessao.mikrotikNome }}</div>
              <div class="text-xs text-muted-foreground">
                {{ sessao.username }} · {{ sessao.ip }} · uptime {{ sessao.uptime || "-" }}
              </div>
            </div>
            <Button
              v-if="canManage"
              size="sm"
              variant="destructive"
              :disabled="disconnectingId === sessao.activeId"
              @click="disconnect(sessao)"
            >
              {{ disconnectingId === sessao.activeId ? "Desconectando..." : "Desconectar" }}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold">Log de conexoes</h3>
        <div class="overflow-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/60">
              <tr>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Data</th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Tipo</th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Hotspot</th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">IP</th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-if="details.conexoes.length === 0">
                <td colspan="5" class="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma conexao registrada.</td>
              </tr>
              <tr v-for="conexao in details.conexoes" :key="conexao.id">
                <td class="px-3 py-2">{{ formatDate(conexao.loginEm) }}</td>
                <td class="px-3 py-2">{{ conexao.tipo }}</td>
                <td class="px-3 py-2">{{ conexao.hotspot?.nome ?? "-" }}</td>
                <td class="px-3 py-2">{{ conexao.ip ?? "-" }}</td>
                <td class="px-3 py-2">
                  <Badge :variant="conexao.status === 'LIBERADO' ? 'default' : 'outline'">{{ conexao.status }}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <template #footer>
      <Button variant="outline" @click="detailsOpen = false">Fechar</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import DataTableControls from "@/components/ui/DataTableControls.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError, getCurrentRole } from "@/services/api";
import { toast } from "@/services/toast";
import type { Dispositivo, DispositivoDetalhes, DispositivoSessaoAtiva } from "@/types/hotspot";

// Editar dados e desconectar sessoes: apenas quem gerencia dispositivos.
// Seller e user tem acesso somente leitura.
const canManage = computed(() => ["admin", "manager", "marketing"].includes(getCurrentRole() ?? ""));

const items = ref<Dispositivo[]>([]);
const error = ref("");
const onlineMacs = ref<Set<string>>(new Set());
const onlineLoading = ref(false);
const onlineError = ref("");
const searchTerm = ref("");
const currentPage = ref(1);
const pageSize = ref(10);

const editOpen = ref(false);
const editing = ref<Dispositivo | null>(null);
const saving = ref(false);
const form = reactive({
  nome: "",
  email: "",
  cpf: "",
  telefone: "",
  whatsapp: "",
  endereco: "",
  cidade: "",
  cep: "",
  aceitouTermos: false,
});

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref("");
const details = ref<DispositivoDetalhes | null>(null);
const disconnectingId = ref("");

const filteredItems = computed(() => {
  const term = normalizeSearch(searchTerm.value);
  if (!term) return items.value;
  return items.value.filter((item) => searchText(item).includes(term));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)));
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

const infoFields = computed(() => {
  const d = details.value?.dispositivo;
  if (!d) return [];
  return [
    { label: "Nome", value: d.nome ?? "-" },
    { label: "MAC", value: d.mac },
    { label: "Email", value: d.email ?? "-" },
    { label: "CPF", value: d.cpf ?? "-" },
    { label: "Telefone", value: d.telefone ?? "-" },
    { label: "WhatsApp", value: d.whatsapp ?? "-" },
    { label: "Endereco", value: [d.endereco, d.cidade, d.cep].filter(Boolean).join(" / ") || "-" },
    { label: "Ultimo hotspot", value: d.ultimoHotspot?.nome ?? "-" },
    { label: "Ultimo IP", value: d.ultimoIp ?? "-" },
    { label: "Total de conexoes", value: String(d.totalConexoes) },
    { label: "Ultima conexao", value: formatDate(d.ultimaConexao) },
    { label: "Aceitou termos", value: d.aceitouTermos ? formatDate(d.aceitouTermosEm) || "Sim" : "Nao" },
  ];
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function searchText(item: Dispositivo): string {
  return normalizeSearch(
    [
      item.nome,
      item.email,
      item.cpf,
      item.mac,
      item.telefone,
      item.whatsapp,
      item.endereco,
      item.cidade,
      item.cep,
      item.ultimoHotspot?.nome,
      item.ultimoIp,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function loadItems(): Promise<void> {
  error.value = "";
  try {
    items.value = await api.get<Dispositivo[]>("/dispositivos");
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar os dispositivos.";
  }
  void loadOnline();
}

// Consulta ao vivo (pode demorar/falhar por MikroTik): roda separada da tabela
// para nao travar a listagem.
async function loadOnline(): Promise<void> {
  onlineLoading.value = true;
  onlineError.value = "";
  try {
    const { macs, erro } = await api.get<{ macs: string[]; erro: string | null }>("/dispositivos/online");
    onlineMacs.value = new Set(macs);
    onlineError.value = erro ?? "";
  } catch (requestError) {
    onlineMacs.value = new Set();
    onlineError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel consultar o status online.";
  } finally {
    onlineLoading.value = false;
  }
}

function openEdit(item: Dispositivo): void {
  editing.value = item;
  form.nome = item.nome ?? "";
  form.email = item.email ?? "";
  form.cpf = item.cpf ?? "";
  form.telefone = item.telefone ?? "";
  form.whatsapp = item.whatsapp ?? "";
  form.endereco = item.endereco ?? "";
  form.cidade = item.cidade ?? "";
  form.cep = item.cep ?? "";
  form.aceitouTermos = item.aceitouTermos;
  editOpen.value = true;
}

async function saveEdit(): Promise<void> {
  if (!editing.value) return;
  saving.value = true;
  try {
    const updated = await api.put<Dispositivo>(`/dispositivos/${editing.value.id}`, {
      nome: form.nome,
      email: form.email,
      cpf: form.cpf,
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      endereco: form.endereco,
      cidade: form.cidade,
      cep: form.cep,
      aceitouTermos: form.aceitouTermos,
    });
    const index = items.value.findIndex((item) => item.id === updated.id);
    if (index !== -1) items.value[index] = updated;
    editOpen.value = false;
    toast.success("Dispositivo salvo", "Os dados do dispositivo foram atualizados.");
  } catch (requestError) {
    toast.error("Nao foi possivel salvar o dispositivo", requestError instanceof ApiError ? requestError.message : "Nao foi possivel salvar o dispositivo.");
  } finally {
    saving.value = false;
  }
}

async function openDetails(item: Dispositivo): Promise<void> {
  detailsOpen.value = true;
  detailsLoading.value = true;
  detailsError.value = "";
  details.value = null;
  try {
    details.value = await api.get<DispositivoDetalhes>(`/dispositivos/${item.id}/detalhes`);
  } catch (requestError) {
    detailsError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar os detalhes.";
  } finally {
    detailsLoading.value = false;
  }
}

async function disconnect(sessao: DispositivoSessaoAtiva): Promise<void> {
  if (!details.value) return;
  detailsError.value = "";
  disconnectingId.value = sessao.activeId;
  try {
    await api.post(`/dispositivos/${details.value.dispositivo.id}/disconnect`, {
      mikrotikId: sessao.mikrotikId,
      activeId: sessao.activeId,
      username: sessao.username,
    });
    await openDetails(details.value.dispositivo);
    void loadOnline();
  } catch (requestError) {
    detailsError.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel desconectar o dispositivo.";
  } finally {
    disconnectingId.value = "";
  }
}

watch([searchTerm, pageSize], () => {
  currentPage.value = 1;
});

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages;
});

// Atualiza o status "Online" periodicamente enquanto a pagina esta aberta. Pausa
// quando a aba nao esta visivel ou ha uma consulta em andamento, para nao
// empilhar requisicoes ao MikroTik.
const ONLINE_POLL_MS = 20000;
let onlinePoll: ReturnType<typeof setInterval> | undefined;

function startOnlinePolling(): void {
  stopOnlinePolling();
  onlinePoll = setInterval(() => {
    if (document.hidden || onlineLoading.value) return;
    void loadOnline();
  }, ONLINE_POLL_MS);
}

function stopOnlinePolling(): void {
  if (onlinePoll) {
    clearInterval(onlinePoll);
    onlinePoll = undefined;
  }
}

onMounted(() => {
  void loadItems();
  startOnlinePolling();
});

onUnmounted(stopOnlinePolling);
</script>
