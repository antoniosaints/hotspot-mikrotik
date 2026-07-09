import type { FastifyReply, FastifyRequest } from "fastify";

export const AdminRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  MARKETING: "marketing",
  SELLER: "seller",
  USER: "user",
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const ADMIN_ROLES: AdminRole[] = ["admin", "manager", "marketing", "seller", "user"];

// Grupos de papeis reutilizados na definicao das rotas, para manter a matriz de
// permissoes num unico lugar.
export const RoleGroup = {
  // Todos os papeis autenticados.
  ALL: ["admin", "manager", "marketing", "seller", "user"] as AdminRole[],
  // Estrutura de rede/negocio (apenas admin/manager).
  STRUCTURE: ["admin", "manager"] as AdminRole[],
  // Gestao de conteudo/marketing: campanhas, planos, telas de cadastro.
  MARKETING_MANAGE: ["admin", "manager", "marketing"] as AdminRole[],
  // Vendas: vouchers e logins CPF.
  SALES_MANAGE: ["admin", "manager", "marketing", "seller"] as AdminRole[],
  // Dispositivos e prospeccoes: leitura ampla.
  READ_WIDE: ["admin", "manager", "marketing", "seller", "user"] as AdminRole[],
  // Dispositivos: quem pode editar/desconectar.
  DEVICES_WRITE: ["admin", "manager", "marketing"] as AdminRole[],
  // Dashboard (marketing nao acessa).
  DASHBOARD: ["admin", "manager", "seller", "user"] as AdminRole[],
} as const;

export type AdminRouteKey =
  | "dashboard"
  | "locais"
  | "mikrotiks"
  | "integracoes"
  | "hotspots"
  | "cadastros-telas"
  | "campanhas"
  | "planos"
  | "bilheteria"
  | "prospeccoes"
  | "dispositivos"
  | "vouchers"
  | "logins"
  | "mikrotik-config"
  | "configuracoes"
  | "usuarios";

export type AdminTokenPayload = {
  id: string;
  usuario: string;
  role: AdminRole;
};

const routeRoles: Record<AdminRouteKey, AdminRole[]> = {
  dashboard: RoleGroup.DASHBOARD,
  locais: RoleGroup.STRUCTURE,
  mikrotiks: RoleGroup.STRUCTURE,
  integracoes: RoleGroup.STRUCTURE,
  hotspots: RoleGroup.STRUCTURE,
  "cadastros-telas": RoleGroup.MARKETING_MANAGE,
  campanhas: RoleGroup.MARKETING_MANAGE,
  planos: RoleGroup.MARKETING_MANAGE,
  bilheteria: RoleGroup.MARKETING_MANAGE,
  prospeccoes: RoleGroup.READ_WIDE,
  dispositivos: RoleGroup.READ_WIDE,
  vouchers: RoleGroup.SALES_MANAGE,
  logins: RoleGroup.SALES_MANAGE,
  "mikrotik-config": RoleGroup.STRUCTURE,
  configuracoes: RoleGroup.STRUCTURE,
  usuarios: ["admin"],
};

export function canAccessRoute(role: AdminRole, route: AdminRouteKey) {
  return routeRoles[route].includes(role);
}

export function canManageUsers(role: AdminRole) {
  return role === AdminRole.ADMIN;
}

export function canDisconnectClients(role: AdminRole) {
  return role === AdminRole.ADMIN || role === AdminRole.MANAGER;
}

export function getAdminPayload(request: FastifyRequest) {
  return request.user as AdminTokenPayload;
}

export function requireAnyRole(...roles: AdminRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = getAdminPayload(request);
    if (!roles.includes(payload.role)) {
      return reply.status(403).send({ error: "Voce nao tem permissao para realizar esta operacao." });
    }
  };
}

export function requireRoute(route: AdminRouteKey) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = getAdminPayload(request);
    if (!canAccessRoute(payload.role, route)) {
      return reply.status(403).send({ error: "Voce nao tem permissao para acessar este recurso." });
    }
  };
}
