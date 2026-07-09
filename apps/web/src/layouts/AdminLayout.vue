<template>
  <div class="min-h-screen bg-background text-foreground">
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-card/95 px-4 py-5 shadow-2xl shadow-black/20 lg:block"
    >
      <SidebarContent />
    </aside>

    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
      @click="sidebarOpen = false"
    >
      <aside class="h-full w-72 border-r border-border bg-card px-4 py-5" @click.stop>
        <SidebarContent @navigate="sidebarOpen = false" />
      </aside>
    </div>

    <div class="lg:pl-72">
      <header class="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div class="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Button class="lg:hidden" variant="ghost" size="icon" aria-label="Abrir menu" @click="sidebarOpen = true">
            <Menu class="h-5 w-5" />
          </Button>
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Hotspot</p>
            <h1 class="text-lg font-semibold leading-tight">{{ route.meta.title ?? "Dashboard" }}</h1>
          </div>
          <div class="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              :aria-label="theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'"
              @click="toggleTheme"
            >
              <Sun v-if="theme === 'dark'" class="h-5 w-5" />
              <Moon v-else class="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Gauge,
  Link2,
  LogOut,
  MapPinned,
  Megaphone,
  Menu,
  MonitorSmartphone,
  Moon,
  Sun,
  ClipboardList,
  ReceiptText,
  RadioTower,
  Router,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-vue-next";
import { computed, defineComponent, h, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import NotificationBell from "@/components/ui/NotificationBell.vue";
import { clearToken, getCurrentAdmin, type AdminRole } from "@/services/api";
import { useTheme } from "@/services/theme";

const { theme, toggleTheme } = useTheme();
const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);

const currentAdmin = computed(() => getCurrentAdmin());
const currentRole = computed<AdminRole>(() => currentAdmin.value?.role ?? "user");

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: Gauge, roles: ["admin", "manager", "seller", "user"] },
  { label: "Locais", to: "/locais", icon: MapPinned, roles: ["admin", "manager"] },
  { label: "Equipamentos", to: "/mikrotiks", icon: Router, roles: ["admin", "manager"] },
  { label: "Integracoes", to: "/integracoes", icon: Link2, roles: ["admin", "manager"] },
  { label: "Hotspots", to: "/hotspots", icon: RadioTower, roles: ["admin", "manager"] },
  { label: "Telas de cadastro", to: "/cadastros-telas", icon: ClipboardList, roles: ["admin", "manager", "marketing"] },
  { label: "Campanhas", to: "/campanhas", icon: Megaphone, roles: ["admin", "manager", "marketing"] },
  { label: "Planos", to: "/planos", icon: ReceiptText, roles: ["admin", "manager", "marketing"] },
  { label: "Prospeccoes", to: "/prospeccoes", icon: Users, roles: ["admin", "manager", "marketing", "seller", "user"] },
  { label: "Dispositivos", to: "/dispositivos", icon: MonitorSmartphone, roles: ["admin", "manager", "marketing", "seller", "user"] },
  { label: "Vouchers", to: "/vouchers", icon: Ticket, roles: ["admin", "manager", "marketing", "seller"] },
  { label: "Logins CPF", to: "/logins", icon: ShieldCheck, roles: ["admin", "manager", "marketing", "seller"] },
  { label: "Usuarios", to: "/usuarios", icon: Users, roles: ["admin"] },
  { label: "Configuracoes", to: "/configuracoes", icon: Settings, roles: ["admin", "manager"] },
];

const visibleNavigation = computed(() => navigation.filter((item) => item.roles.includes(currentRole.value)));

const activePath = computed(() => route.path);

const SidebarContent = defineComponent({
  emits: ["navigate"],
  setup(_, { emit }) {
    return () =>
      h("div", { class: "flex h-full flex-col" }, [
        h("div", { class: "mb-8 flex items-center gap-3 px-2" }, [
          h(
            "img",
            { class: "flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground", src: "/img/logo.png" },
          ),
          h("div", [
            h("p", { class: "text-sm font-semibold" }, "Hotspot CAS"),
            h("p", { class: "text-xs text-muted-foreground" }, "Controle de Hotspot CAS"),
          ]),
        ]),
        h(
          "nav",
          { class: "space-y-1" },
          visibleNavigation.value.map((item) =>
            h(
              RouterLink,
              {
                to: item.to,
                class: [
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  activePath.value === item.to
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                ],
                onClick: () => emit("navigate"),
              },
              () => [h(item.icon, { class: "h-4 w-4" }), h("span", item.label)],
            ),
          ),
        ),
        h("div", { class: "mt-auto space-y-4" }, [
          h("div", { class: "rounded-lg border border-border bg-background/60 p-3" }, [
            h("div", { class: "mb-2 flex items-center justify-between gap-2" }, [
              h("span", { class: "text-xs font-medium text-muted-foreground" }, "Ambiente"),
              h(Badge, { variant: "secondary" }, () => currentRole.value),
            ]),
            h("p", { class: "text-xs leading-5 text-muted-foreground" }, currentAdmin.value?.usuario ?? "Sessao ativa."),
          ]),
          h(
            "button",
            {
              type: "button",
              class:
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              onClick: () => {
                clearToken();
                emit("navigate");
                void router.push("/login");
              },
            },
            [h(LogOut, { class: "h-4 w-4" }), h("span", "Logout")],
          ),
        ]),
      ]);
  },
});
</script>
