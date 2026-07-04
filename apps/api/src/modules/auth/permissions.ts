import type { FastifyReply, FastifyRequest } from "fastify";

export const AdminRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export type AdminRouteKey =
  | "dashboard"
  | "locais"
  | "mikrotiks"
  | "integracoes"
  | "hotspots"
  | "cadastros-telas"
  | "bilheteria"
  | "prospeccoes"
  | "vouchers"
  | "logins"
  | "mikrotik-config"
  | "usuarios";

export type AdminTokenPayload = {
  id: string;
  usuario: string;
  role: AdminRole;
};

const routeRoles: Record<AdminRouteKey, AdminRole[]> = {
  dashboard: ["admin", "manager", "user"],
  locais: ["admin", "manager"],
  mikrotiks: ["admin", "manager"],
  integracoes: ["admin", "manager"],
  hotspots: ["admin", "manager"],
  "cadastros-telas": ["admin", "manager"],
  bilheteria: ["admin", "manager"],
  prospeccoes: ["admin", "manager"],
  vouchers: ["admin", "user"],
  logins: ["admin", "user"],
  "mikrotik-config": ["admin", "manager"],
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
