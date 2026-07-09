<template>
  <div ref="root" class="relative">
    <Button variant="ghost" size="icon" aria-label="Notificacoes" @click="toggle">
      <Bell class="h-5 w-5" />
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
      >
        {{ unreadCount > 99 ? "99+" : unreadCount }}
      </span>
    </Button>

    <div
      v-if="open"
      class="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <p class="text-sm font-semibold">Notificacoes</p>
        <button
          v-if="eventos.length > 0"
          type="button"
          class="text-xs text-muted-foreground hover:text-foreground"
          @click="markAllSeen"
        >
          Marcar como lidas
        </button>
      </div>

      <div class="max-h-96 overflow-y-auto">
        <p v-if="loading && eventos.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
        <p v-else-if="eventos.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma notificacao recente.
        </p>
        <ul v-else class="divide-y divide-border">
          <li
            v-for="evento in eventos"
            :key="evento.id"
            class="flex gap-3 px-4 py-3"
            :class="isUnread(evento) ? 'bg-primary/5' : ''"
          >
            <span class="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full" :class="iconClass(evento.tipo)">
              <component :is="iconFor(evento.tipo)" class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium">{{ evento.titulo }}</p>
                <span v-if="isUnread(evento)" class="h-2 w-2 flex-none rounded-full bg-primary" />
              </div>
              <p class="truncate text-xs text-muted-foreground">{{ evento.descricao }}</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                {{ formatRelative(evento.data) }}<span v-if="evento.hotspotNome"> · {{ evento.hotspotNome }}</span>
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell, ShoppingCart, UserPlus, Wifi } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import { api } from "@/services/api";
import type { Notificacao, NotificacaoTipo } from "@/types/hotspot";

const SEEN_KEY = "hotspot_notif_seen";
const POLL_MS = 30000;

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const loading = ref(false);
const eventos = ref<Notificacao[]>([]);
const lastSeen = ref<number>(Number(localStorage.getItem(SEEN_KEY) ?? 0));

let poll: ReturnType<typeof setInterval> | undefined;

const unreadCount = computed(() => eventos.value.filter((evento) => isUnread(evento)).length);

function isUnread(evento: Notificacao): boolean {
  return new Date(evento.data).getTime() > lastSeen.value;
}

function iconFor(tipo: NotificacaoTipo) {
  if (tipo === "cadastro") return UserPlus;
  if (tipo === "compra") return ShoppingCart;
  return Wifi;
}

function iconClass(tipo: NotificacaoTipo): string {
  if (tipo === "cadastro") return "bg-cyan-500/15 text-cyan-500";
  if (tipo === "compra") return "bg-emerald-500/15 text-emerald-500";
  return "bg-blue-500/15 text-blue-500";
}

function formatRelative(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `ha ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `ha ${hours} h`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) void loadNotifications();
}

function markAllSeen(): void {
  const newest = eventos.value[0];
  lastSeen.value = newest ? new Date(newest.data).getTime() : Date.now();
  localStorage.setItem(SEEN_KEY, String(lastSeen.value));
}

async function loadNotifications(): Promise<void> {
  loading.value = true;
  try {
    const response = await api.get<{ eventos: Notificacao[] }>("/notificacoes");
    eventos.value = response.eventos;
  } catch {
    // Silencioso: o sino nao deve poluir a UI com erros de rede transitorios.
  } finally {
    loading.value = false;
  }
}

function handleClickOutside(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) {
    open.value = false;
  }
}

onMounted(() => {
  void loadNotifications();
  poll = setInterval(() => {
    if (!document.hidden) void loadNotifications();
  }, POLL_MS);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  if (poll) clearInterval(poll);
  document.removeEventListener("click", handleClickOutside);
});
</script>
