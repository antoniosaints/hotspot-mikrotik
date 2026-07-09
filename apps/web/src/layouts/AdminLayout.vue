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
    <AutoHelpMenu />
    <ToastViewport />
  </div>
</template>

<script setup lang="ts">
import {
  ChevronDown,
  Clock,
  DoorOpen,
  FolderCog,
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
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import Button from "@/components/ui/Button.vue";
import AutoHelpMenu from "@/components/AutoHelpMenu.vue";
import NotificationBell from "@/components/ui/NotificationBell.vue";
import ToastViewport from "@/components/ui/ToastViewport.vue";
import { clearToken, getCurrentAdmin, type AdminRole } from "@/services/api";
import { useTheme } from "@/services/theme";

const { theme, toggleTheme } = useTheme();
const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);
const now = ref(new Date());
let clockInterval: ReturnType<typeof setInterval> | undefined;

const currentAdmin = computed(() => getCurrentAdmin());
const currentRole = computed<AdminRole>(() => currentAdmin.value?.role ?? "user");
const currentUserName = computed(() => currentAdmin.value?.nome || "Usuario");
const currentUserLogin = computed(() => currentAdmin.value?.usuario || "Sessao ativa");
const currentTime = computed(() =>
  now.value.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }),
);

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: Gauge, roles: ["admin", "manager", "seller", "user"] },
  { label: "Usuarios", to: "/usuarios", icon: Users, roles: ["admin"] },
  { label: "Configuracoes", to: "/configuracoes", icon: Settings, roles: ["admin", "manager"] },
  { label: "Apps", to: "/integracoes", icon: Link2, roles: ["admin", "manager"] },
];

const managementNavigation = [
  { label: "Locais", to: "/locais", icon: MapPinned, roles: ["admin", "manager"] },
  { label: "Equipamentos", to: "/mikrotiks", icon: Router, roles: ["admin", "manager"] },
  { label: "Hotspots", to: "/hotspots", icon: RadioTower, roles: ["admin", "manager"] },
];

const accessNavigation = [
  { label: "Logins CPF", to: "/logins", icon: ShieldCheck, roles: ["admin", "manager", "marketing", "seller"] },
  { label: "Dispositivos", to: "/dispositivos", icon: MonitorSmartphone, roles: ["admin", "manager", "marketing", "seller", "user"] },
  { label: "Vouchers", to: "/vouchers", icon: Ticket, roles: ["admin", "manager", "marketing", "seller"] },
  { label: "Planos", to: "/planos", icon: ReceiptText, roles: ["admin", "manager", "marketing"] },
  { label: "Telas de cadastro", to: "/cadastros-telas", icon: ClipboardList, roles: ["admin", "manager", "marketing"] },
];

const marketingNavigation = [
  { label: "Prospeccoes", to: "/prospeccoes", icon: Users, roles: ["admin", "manager", "marketing", "seller", "user"] },
  { label: "Campanhas", to: "/campanhas", icon: Megaphone, roles: ["admin", "manager", "marketing"] },
];

const visibleNavigation = computed(() => navigation.filter((item) => item.roles.includes(currentRole.value)));
const visibleManagementNavigation = computed(() =>
  managementNavigation.filter((item) => item.roles.includes(currentRole.value)),
);
const visibleAccessNavigation = computed(() =>
  accessNavigation.filter((item) => item.roles.includes(currentRole.value)),
);
const visibleMarketingNavigation = computed(() =>
  marketingNavigation.filter((item) => item.roles.includes(currentRole.value)),
);

const activePath = computed(() => route.path);
const managementActive = computed(() => visibleManagementNavigation.value.some((item) => item.to === activePath.value));
const accessActive = computed(() => visibleAccessNavigation.value.some((item) => item.to === activePath.value));
const marketingActive = computed(() => visibleMarketingNavigation.value.some((item) => item.to === activePath.value));
const managementOpen = ref(true);
const accessOpen = ref(true);
const marketingOpen = ref(true);

onMounted(() => {
  clockInterval = setInterval(() => {
    now.value = new Date();
  }, 30000);
});

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
});

const SidebarContent = defineComponent({
  emits: ["navigate"],
  setup(_, { emit }) {
    const renderNavItem = (item: (typeof navigation)[number], indented = false) =>
      h(
        RouterLink,
        {
          to: item.to,
          class: [
            "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
            indented ? "ml-4 border-l border-border/80 px-3 py-2 pl-5" : "px-3 py-2.5",
            activePath.value === item.to
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          ],
          onClick: () => emit("navigate"),
        },
        () => [h(item.icon, { class: "h-4 w-4" }), h("span", item.label)],
      );

    const renderDropdown = (input: {
      label: string;
      icon: typeof FolderCog;
      items: typeof visibleNavigation.value;
      active: boolean;
      open: boolean;
      toggle: () => void;
    }) =>
      input.items.length
        ? h("div", { class: "space-y-1" }, [
            h(
              "button",
              {
                type: "button",
                class: [
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  input.active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                ],
                "aria-expanded": input.open,
                onClick: input.toggle,
              },
              [
                h(input.icon, { class: "h-4 w-4" }),
                h("span", { class: "flex-1 text-left" }, input.label),
                h(ChevronDown, {
                  class: [
                    "h-4 w-4 transition-transform",
                    input.open ? "rotate-180" : "",
                  ],
                }),
              ],
            ),
            input.open
              ? h(
                  "div",
                  { class: "space-y-1" },
                  input.items.map((item) => renderNavItem(item, true)),
                )
              : null,
          ])
        : null;

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
          [
            renderNavItem(visibleNavigation.value[0]),
            renderDropdown({
              label: "Gerenciamento",
              icon: FolderCog,
              items: visibleManagementNavigation.value,
              active: managementActive.value,
              open: managementOpen.value,
              toggle: () => {
                managementOpen.value = !managementOpen.value;
              },
            }),
            renderDropdown({
              label: "Acesso",
              icon: DoorOpen,
              items: visibleAccessNavigation.value,
              active: accessActive.value,
              open: accessOpen.value,
              toggle: () => {
                accessOpen.value = !accessOpen.value;
              },
            }),
            renderDropdown({
              label: "Marketing",
              icon: Megaphone,
              items: visibleMarketingNavigation.value,
              active: marketingActive.value,
              open: marketingOpen.value,
              toggle: () => {
                marketingOpen.value = !marketingOpen.value;
              },
            }),
            ...visibleNavigation.value.slice(1).map((item) => renderNavItem(item)),
          ],
        ),
        h("div", { class: "mt-auto space-y-3" }, [
          h("div", { class: "border-t border-border pt-4" }, [
            h("p", { class: "truncate text-sm font-semibold text-foreground" }, currentUserName.value),
            h("div", { class: "mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground" }, [
              h("span", { class: "truncate" }, currentUserLogin.value),
              h("span", { class: "inline-flex flex-none items-center gap-1 tabular-nums" }, [
                h(Clock, { class: "h-3.5 w-3.5" }),
                currentTime.value,
              ]),
            ]),
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
