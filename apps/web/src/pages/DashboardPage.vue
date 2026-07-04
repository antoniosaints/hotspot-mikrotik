<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.18em] text-accent">Operacao</p>
        <h2 class="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p class="mt-1 text-sm text-muted-foreground">Indicadores por periodo, local, hotspot e clientes ativos.</p>
      </div>

      <div class="grid gap-2 grid-cols-2 xl:grid-cols-4">
        <Input v-model="filters.from" type="date" />
        <Input v-model="filters.to" type="date" />
        <Select v-model="filters.localId" placeholder="Todos os locais">
          <option value="">Todos os locais</option>
          <option v-for="local in data?.filters.locais ?? []" :key="local.id" :value="local.id">{{ local.nome }}</option>
        </Select>
        <Select v-model="filters.hotspotId" placeholder="Todos os hotspots">
          <option value="">Todos os hotspots</option>
          <option v-for="hotspot in filteredHotspots" :key="hotspot.id" :value="hotspot.id">{{ hotspot.nome }}</option>
        </Select>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button size="sm" @click="loadDashboard">
        <RefreshCw class="h-4 w-4" />
        Aplicar filtros
      </Button>
      <Button size="sm" variant="secondary" @click="resetPeriod">Ultimos 7 dias</Button>
      <Button size="sm" variant="secondary" @click="setMonthPeriod">Mes atual</Button>
    </div>

    <Alert v-if="error" variant="destructive">{{ error }}</Alert>

    <div class="grid gap-4 grid-cols-2 xl:grid-cols-6">
      <Card v-for="kpi in kpis" :key="kpi.label">
        <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ kpi.label }}</p>
        <p class="mt-2 text-3xl font-semibold">{{ kpi.value }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ kpi.help }}</p>
      </Card>
    </div>

    <div class="grid gap-5 grid-cols-1 xl:grid-cols-6">
      <Card class="xl:col-span-4" title="Conexoes por periodo" description="Volume diario de logins liberados">
        <div class="h-72">
          <canvas ref="dailyCanvas"></canvas>
        </div>
      </Card>

      <Card class="xl:col-span-2" title="Tipos de login" description="Distribuicao no periodo filtrado">
        <div class="h-72">
          <canvas ref="typeCanvas"></canvas>
        </div>
      </Card>
    </div>

    <div class="grid gap-5 grid-cols-1 xl:grid-cols-2">
      <Card title="Logins por local" description="Locais com maior volume">
        <div class="h-72">
          <canvas ref="localCanvas"></canvas>
        </div>
      </Card>

      <Card title="Logins por hotspot" description="Hotspots com maior volume">
        <div class="h-72">
          <canvas ref="hotspotCanvas"></canvas>
        </div>
      </Card>
    </div>

    <Card title="Clientes logados" description="Sessoes ativas no MikroTik">
      <Table>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Usuario</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">IP/MAC</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Local/Hotspot</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">MikroTik</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Tempo</th>
            <th class="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">Acao</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-if="(data?.activeClients ?? []).length === 0">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum cliente ativo encontrado.</td>
          </tr>
          <tr v-for="client in data?.activeClients ?? []" :key="`${client.mikrotikId}-${client.id}`">
            <td class="px-4 py-3 text-sm">
              <div class="font-medium">{{ client.username }}</div>
              <div v-if="client.error" class="mt-1 text-xs text-destructive">{{ client.error }}</div>
            </td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ client.ip }} / {{ client.mac }}</td>
            <td class="px-4 py-3 text-sm">{{ client.localNome }} / {{ client.hotspotNome }}</td>
            <td class="px-4 py-3 text-sm">{{ client.mikrotikNome }}</td>
            <td class="px-4 py-3 text-sm">{{ client.uptime }}</td>
            <td class="px-4 py-3 text-right">
              <div v-if="!client.error && canDisconnect" class="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  :disabled="disconnectingId === `${client.mikrotikId}-${client.id}`"
                  @click="disconnectClient(client)"
                >
                  Desconectar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="disconnectingId === `${client.mikrotikId}-${client.id}`"
                  @click="disconnectClient(client, true)"
                >
                  Desconectar + user
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </Table>
    </Card>

    <Card title="Acessos recentes">
      <Table>
        <thead class="bg-muted/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Quando</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Tipo</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Codigo</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">Hotspot</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">MAC/IP</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="access in data?.recentAccesses ?? []" :key="access.id">
            <td class="whitespace-nowrap px-4 py-3 text-sm">{{ formatDate(access.loginEm) }}</td>
            <td class="px-4 py-3"><Badge>{{ loginTypeLabel(access.tipo) }}</Badge></td>
            <td class="px-4 py-3 text-sm">{{ access.codigo }}</td>
            <td class="px-4 py-3 text-sm">{{ access.hotspot?.nome ?? "-" }}</td>
            <td class="px-4 py-3 text-sm text-muted-foreground">{{ access.mac ?? "-" }} / {{ access.ip ?? "-" }}</td>
          </tr>
        </tbody>
      </Table>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Chart, registerables, type ChartConfiguration } from "chart.js";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";

import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import Table from "@/components/ui/Table.vue";
import { api, ApiError, getCurrentRole } from "@/services/api";
import type { DashboardData, LoginType } from "@/types/hotspot";

Chart.register(...registerables);

const data = ref<DashboardData | null>(null);
const error = ref("");
const disconnectingId = ref("");
const filters = reactive({ from: "", to: "", localId: "", hotspotId: "" });

const dailyCanvas = ref<HTMLCanvasElement | null>(null);
const typeCanvas = ref<HTMLCanvasElement | null>(null);
const localCanvas = ref<HTMLCanvasElement | null>(null);
const hotspotCanvas = ref<HTMLCanvasElement | null>(null);
const charts: Chart[] = [];

const kpis = computed(() => [
  { label: "Acessos", value: data.value?.totals.acessos ?? 0, help: "logins no periodo" },
  { label: "Ativos", value: data.value?.totals.clientesAtivos ?? 0, help: "clientes online" },
  { label: "Vouchers", value: data.value?.totals.vouchersTotal ?? 0, help: "emitidos no filtro" },
  { label: "Disponiveis", value: data.value?.totals.vouchersDisponiveis ?? 0, help: "ainda nao usados" },
  { label: "Hotspots", value: data.value?.totals.hotspots ?? 0, help: "portais filtrados" },
  { label: "MikroTiks", value: data.value?.totals.mikrotiks ?? 0, help: "roteadores cadastrados" },
]);

const filteredHotspots = computed(() =>
  (data.value?.filters.hotspots ?? []).filter((hotspot) => !filters.localId || hotspot.localId === filters.localId),
);
const canDisconnect = computed(() => {
  const role = getCurrentRole();
  return role === "admin" || role === "manager";
});

function chartColors() {
  return {
    blue: "#2f8cff",
    cyan: "#38bdf8",
    green: "#22c55e",
    yellow: "#f59e0b",
    red: "#ef4444",
    grid: "rgba(148, 163, 184, 0.18)",
    text: "#94a3b8",
  };
}

function destroyCharts(): void {
  while (charts.length) charts.pop()?.destroy();
}

function makeChart(canvas: HTMLCanvasElement | null, config: ChartConfiguration): void {
  if (!canvas) return;
  charts.push(new Chart(canvas, config));
}

function renderCharts(): void {
  destroyCharts();
  if (!data.value) return;

  const colors = chartColors();
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: colors.text } } },
    scales: {
      x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
      y: { ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid }, beginAtZero: true },
    },
  };

  makeChart(dailyCanvas.value, {
    type: "line",
    data: {
      labels: data.value.accessByDay.map((day) => shortDate(day.date)),
      datasets: [{ label: "Conexoes", data: data.value.accessByDay.map((day) => day.total), borderColor: colors.blue, backgroundColor: "rgba(47, 140, 255, 0.18)", fill: true, tension: 0.35 }],
    },
    options: baseOptions,
  });

  makeChart(typeCanvas.value, {
    type: "doughnut",
    data: {
      labels: data.value.accessByType.map((item) => loginTypeLabel(item.tipo)),
      datasets: [{ data: data.value.accessByType.map((item) => item.total), backgroundColor: [colors.blue, colors.green, colors.yellow] }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: colors.text } } } },
  });

  makeChart(localCanvas.value, {
    type: "bar",
    data: {
      labels: data.value.accessByLocal.map((item) => item.nome),
      datasets: [{ label: "Logins", data: data.value.accessByLocal.map((item) => item.total), backgroundColor: colors.cyan }],
    },
    options: baseOptions,
  });

  makeChart(hotspotCanvas.value, {
    type: "bar",
    data: {
      labels: data.value.accessByHotspot.map((item) => item.nome),
      datasets: [{ label: "Logins", data: data.value.accessByHotspot.map((item) => item.total), backgroundColor: colors.blue }],
    },
    options: baseOptions,
  });
}

function queryString(): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.localId) params.set("localId", filters.localId);
  if (filters.hotspotId) params.set("hotspotId", filters.hotspotId);
  return params.toString();
}

async function loadDashboard(): Promise<void> {
  error.value = "";
  try {
    const suffix = queryString();
    data.value = await api.get<DashboardData>(`/dashboard${suffix ? `?${suffix}` : ""}`);
    filters.from = data.value.filters.from;
    filters.to = data.value.filters.to;
    filters.localId = data.value.filters.localId;
    filters.hotspotId = data.value.filters.hotspotId;
    await nextTick();
    renderCharts();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel carregar o dashboard.";
  }
}

function resetPeriod(): void {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  filters.from = from.toISOString().slice(0, 10);
  filters.to = today.toISOString().slice(0, 10);
  void loadDashboard();
}

function setMonthPeriod(): void {
  const today = new Date();
  filters.from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  filters.to = today.toISOString().slice(0, 10);
  void loadDashboard();
}

async function disconnectClient(client: NonNullable<DashboardData["activeClients"]>[number], removeUser = false): Promise<void> {
  if (removeUser && !window.confirm(`Desconectar e apagar o usuario "${client.username}" do MikroTik?`)) return;
  const key = `${client.mikrotikId}-${client.id}`;
  disconnectingId.value = key;
  error.value = "";
  try {
    await api.post(`/dashboard/active-clients/${client.mikrotikId}/disconnect`, {
      activeId: client.id,
      username: client.username,
      removeUser,
    });
    await loadDashboard();
  } catch (requestError) {
    error.value = requestError instanceof ApiError ? requestError.message : "Nao foi possivel desconectar o cliente.";
  } finally {
    disconnectingId.value = "";
  }
}

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function loginTypeLabel(tipo: LoginType): string {
  if (tipo === "CPF") return "CPF local";
  if (tipo === "IXC") return "Integracao";
  if (tipo === "COMPRA") return "Compra";
  if (tipo === "CONTRATACAO") return "Contratacao";
  return "Voucher";
}

watch(
  () => filters.localId,
  () => {
    if (filters.hotspotId && !filteredHotspots.value.some((hotspot) => hotspot.id === filters.hotspotId)) {
      filters.hotspotId = "";
    }
  },
);

onMounted(loadDashboard);
onBeforeUnmount(destroyCharts);
</script>
