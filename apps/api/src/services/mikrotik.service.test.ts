import { describe, expect, it } from "vitest";
import { installRouterOsEmptyReplyPatch, testConnection } from "./mikrotik.service.js";

describe("installRouterOsEmptyReplyPatch", () => {
  it("ignores RouterOS !empty replies so empty lists do not crash the API process", () => {
    const calls: string[][] = [];
    const module = {
      Channel: {
        prototype: {
          processPacket(packet: string[]) {
            calls.push(packet);
            if (packet[0] !== "!done") {
              throw new Error(`unexpected ${packet[0]}`);
            }
          },
        },
      },
    };

    installRouterOsEmptyReplyPatch(module);

    expect(() => module.Channel.prototype.processPacket(["!empty"])).not.toThrow();
    expect(() => module.Channel.prototype.processPacket(["!done"])).not.toThrow();
    expect(calls).toEqual([["!done"]]);
  });
});

describe("testConnection", () => {
  it("returns a clear connection error when RouterOS is unreachable", async () => {
    const result = await testConnection({
      host: "127.0.0.1",
      usuarioApi: "admin",
      senhaApi: "secret",
      portaApi: 1,
      timeoutApi: 500,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Falha na comunicacao com MikroTik");
  });
});
