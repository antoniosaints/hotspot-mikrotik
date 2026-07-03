import { createRouter, createWebHistory } from "vue-router";

import AdminLayout from "@/layouts/AdminLayout.vue";
import BilheteriaPage from "@/pages/BilheteriaPage.vue";
import CpfLoginsPage from "@/pages/CpfLoginsPage.vue";
import DashboardPage from "@/pages/DashboardPage.vue";
import HotspotsPage from "@/pages/HotspotsPage.vue";
import IntegracoesPage from "@/pages/IntegracoesPage.vue";
import LocaisPage from "@/pages/LocaisPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import MikrotikConfigPage from "@/pages/MikrotikConfigPage.vue";
import MikrotiksPage from "@/pages/MikrotiksPage.vue";
import PortalPage from "@/pages/PortalPage.vue";
import ProspeccoesPage from "@/pages/ProspeccoesPage.vue";
import UsuariosPage from "@/pages/UsuariosPage.vue";
import VouchersPage from "@/pages/VouchersPage.vue";
import { getCurrentRole, isAuthenticated, type AdminRole } from "@/services/api";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/dashboard",
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
      meta: { title: "Login" },
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
          meta: { title: "Dashboard", requiresAuth: true, roles: ["admin", "manager", "user"] },
        },
        {
          path: "locais",
          name: "locais",
          component: LocaisPage,
          meta: { title: "Locais", requiresAuth: true, roles: ["admin", "user"] },
        },
        {
          path: "mikrotiks",
          name: "mikrotiks",
          component: MikrotiksPage,
          meta: { title: "MikroTiks", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "integracoes",
          name: "integracoes",
          component: IntegracoesPage,
          meta: { title: "Integracoes", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "hotspots",
          name: "hotspots",
          component: HotspotsPage,
          meta: { title: "Hotspots", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "bilheteria",
          name: "bilheteria",
          component: BilheteriaPage,
          meta: { title: "Bilheteria", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "prospeccoes",
          name: "prospeccoes",
          component: ProspeccoesPage,
          meta: { title: "Prospeccoes", requiresAuth: true, roles: ["admin", "manager"] },
        },
        {
          path: "vouchers",
          name: "vouchers",
          component: VouchersPage,
          meta: { title: "Vouchers", requiresAuth: true, roles: ["admin", "user"] },
        },
        {
          path: "logins",
          name: "logins",
          component: CpfLoginsPage,
          meta: { title: "Logins CPF", requiresAuth: true, roles: ["admin", "user"] },
        },
        {
          path: "mikrotik",
          name: "mikrotik-config",
          component: MikrotikConfigPage,
          meta: { title: "Configuracao MikroTik", requiresAuth: true, roles: ["admin", "manager"] },
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
      return "/dashboard";
    }
  }

  if (to.path === "/login" && isAuthenticated()) {
    return "/dashboard";
  }

  return true;
});

export default router;
