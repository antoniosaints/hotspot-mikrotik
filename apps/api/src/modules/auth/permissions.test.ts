import { describe, expect, it } from "vitest";
import { canAccessRoute, canDisconnectClients, canManageUsers, type AdminRole } from "./permissions.js";

describe("admin permissions", () => {
  it.each<AdminRole>(["admin", "manager", "user"])("allows every role to view dashboard", (role) => {
    expect(canAccessRoute(role, "dashboard")).toBe(true);
  });

  it("keeps user management admin-only", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("manager")).toBe(false);
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
    expect(canAccessRoute("user", "vouchers")).toBe(true);
  });
});
