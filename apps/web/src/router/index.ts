import { createRouter, createWebHistory } from "vue-router";

import AdminLayout from "@/layouts/AdminLayout.vue";
import PlanosPage from "@/pages/PlanosPage.vue";
import CadastrosTelasPage from "@/pages/CadastrosTelasPage.vue";
import CampanhasPage from "@/pages/CampanhasPage.vue";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage.vue";
import CpfLoginsPage from "@/pages/CpfLoginsPage.vue";
import DashboardPage from "@/pages/DashboardPage.vue";
import DispositivosPage from "@/pages/DispositivosPage.vue";
import HotspotsPage from "@/pages/HotspotsPage.vue";
import IntegracoesPage from "@/pages/IntegracoesPage.vue";
import LocaisPage from "@/pages/LocaisPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import MikrotiksPage from "@/pages/MikrotiksPage.vue";
import PortalPage from "@/pages/PortalPage.vue";
import PortalResolvePage from "@/pages/PortalResolvePage.vue";
import ProspeccoesPage from "@/pages/ProspeccoesPage.vue";
import UsuariosPage from "@/pages/UsuariosPage.vue";
import VouchersPage from "@/pages/VouchersPage.vue";
import { getCurrentRole, isAuthenticated, roleHome, type AdminRole } from "@/services/api";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: () => roleHome(getCurrentRole()),
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
      meta: { title: "Login" },
    },
    {
      // Entrada do login.html compartilhado por MikroTik: resolve o hotspot
      // pelo servidor de origem ($(server-name)) e redireciona para o portal.
      path: "/portal/mk/:mikrotikId",
      name: "portal-resolve",
      component: PortalResolvePage,
      meta: { title: "Portal" },
    },
    {
      path: "/portal/:slug",
      name: "portal",
      component: PortalPage,
      meta: { title: "Portal" },
    },
    {
      path: "/",
      component: AdminLayout,
      children: [
        {
          path: "dashboard",
          name: "dashboard",
          component: DashboardPage,
          meta: { title: "Dashboard", requiresAuth: true, roles: ["admin", "manager", "marketing", "seller", "user"] },
        },
        {
          path: "locais",
          name: "locais",
          component: LocaisPage,
          meta: { title: "Locais", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "mikrotiks",
          name: "mikrotiks",
          component: MikrotiksPage,
          meta: { title: "Equipamentos", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "integracoes",
          name: "integracoes",
          component: IntegracoesPage,
          meta: { title: "Apps", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "hotspots",
          name: "hotspots",
          component: HotspotsPage,
          meta: { title: "Hotspots", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "cadastros-telas",
          name: "cadastros-telas",
          component: CadastrosTelasPage,
          meta: { title: "Telas de cadastro", requiresAuth: true, roles: ["admin", "manager", "marketing"] },
        },
        {
          path: "campanhas",
          name: "campanhas",
          component: CampanhasPage,
          meta: { title: "Campanhas", requiresAuth: true, roles: ["admin", "manager", "marketing"] },
        },
        {
          path: "configuracoes",
          name: "configuracoes",
          component: ConfiguracoesPage,
          meta: { title: "Configuracoes", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "planos",
          name: "planos",
          component: PlanosPage,
          meta: { title: "Planos", requiresAuth: true, roles: ["admin", "manager", "marketing"] },
        },
        {
          // Compatibilidade com links antigos da Bilheteria.
          path: "bilheteria",
          redirect: "/planos",
        },
        {
          path: "prospeccoes",
          name: "prospeccoes",
          component: ProspeccoesPage,
          meta: { title: "Prospeccoes", requiresAuth: true, roles: ["admin", "manager", "marketing", "seller", "user"] },
        },
        {
          path: "dispositivos",
          name: "dispositivos",
          component: DispositivosPage,
          meta: { title: "Dispositivos", requiresAuth: true, roles: ["admin", "manager", "marketing", "seller", "user"] },
        },
        {
          path: "vouchers",
          name: "vouchers",
          component: VouchersPage,
          meta: { title: "Vouchers", requiresAuth: true, roles: ["admin", "manager", "marketing", "seller"] },
        },
        {
          path: "logins",
          name: "logins",
          component: CpfLoginsPage,
          meta: { title: "Logins CPF", requiresAuth: true, roles: ["admin", "manager", "marketing", "seller"] },
        },
        {
          path: "usuarios",
          name: "usuarios",
          component: UsuariosPage,
          meta: { title: "Usuarios", requiresAuth: true, roles: ["admin"] },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAuth && Array.isArray(to.meta.roles)) {
    const role = getCurrentRole();
    if (!role || !(to.meta.roles as AdminRole[]).includes(role)) {
      return roleHome(role);
    }
  }

  if (to.path === "/login" && isAuthenticated()) {
    return roleHome(getCurrentRole());
  }

  return true;
});

export default router;
