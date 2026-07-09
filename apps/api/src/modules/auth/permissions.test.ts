import { describe, expect, it } from "vitest";
import { canAccessRoute, canDisconnectClients, canManageUsers, type AdminRole } from "./permissions.js";

describe("admin permissions", () => {
  it.each<AdminRole>(["admin", "manager", "seller", "user"])("allows dashboard for %s", (role) => {
    expect(canAccessRoute(role, "dashboard")).toBe(true);
  });

  it("keeps marketing out of the dashboard", () => {
    expect(canAccessRoute("marketing", "dashboard")).toBe(false);
  });

  it("keeps user management admin-only", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("manager")).toBe(false);
    expect(canManageUsers("marketing")).toBe(false);
    expect(canManageUsers("seller")).toBe(false);
    expect(canManageUsers("user")).toBe(false);
  });

  it("allows managers to disconnect clients but blocks users", () => {
    expect(canDisconnectClients("admin")).toBe(true);
    expect(canDisconnectClients("manager")).toBe(true);
    expect(canDisconnectClients("user")).toBe(false);
  });

  it("matches the approved route matrix", () => {
    expect(canAccessRoute("manager", "mikrotiks")).toBe(true);
    expect(canAccessRoute("manager", "locais")).toBe(true);
    expect(canAccessRoute("manager", "usuarios")).toBe(false);
    expect(canAccessRoute("user", "locais")).toBe(false);
    expect(canAccessRoute("user", "hotspots")).toBe(false);
    // user agora so ve prospeccoes, dispositivos e dashboard (nao vouchers).
    expect(canAccessRoute("user", "vouchers")).toBe(false);
    expect(canAccessRoute("user", "prospeccoes")).toBe(true);
    expect(canAccessRoute("user", "dispositivos")).toBe(true);
  });

  it("gives marketing content management but not structure", () => {
    expect(canAccessRoute("marketing", "campanhas")).toBe(true);
    expect(canAccessRoute("marketing", "planos")).toBe(true);
    expect(canAccessRoute("marketing", "cadastros-telas")).toBe(true);
    expect(canAccessRoute("marketing", "vouchers")).toBe(true);
    expect(canAccessRoute("marketing", "dispositivos")).toBe(true);
    expect(canAccessRoute("marketing", "hotspots")).toBe(false);
    expect(canAccessRoute("marketing", "usuarios")).toBe(false);
  });

  it("scopes seller to sales, devices, prospects and dashboard", () => {
    expect(canAccessRoute("seller", "vouchers")).toBe(true);
    expect(canAccessRoute("seller", "logins")).toBe(true);
    expect(canAccessRoute("seller", "dispositivos")).toBe(true);
    expect(canAccessRoute("seller", "prospeccoes")).toBe(true);
    expect(canAccessRoute("seller", "dashboard")).toBe(true);
    expect(canAccessRoute("seller", "campanhas")).toBe(false);
    expect(canAccessRoute("seller", "hotspots")).toBe(false);
  });
});
