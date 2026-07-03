import { describe, expect, it } from "vitest";
import { normalizePortalLoginBody } from "./portal.routes.js";

describe("normalizePortalLoginBody", () => {
  it("accepts MikroTik hyphenated aliases and normalizes voucher code", () => {
    expect(
      normalizePortalLoginBody({
        loginType: "voucher",
        hotspotSlug: "padrao",
        voucher: " abc 123 ",
        "link-login-only": "http://10.0.0.1/login",
        "link-login": "http://10.0.0.1/login",
        "link-orig": "http://example.com",
        "chap-id": "\\001",
        "chap-challenge-b64": Buffer.from("\\002", "utf8").toString("base64"),
      }),
    ).toMatchObject({
      loginType: "voucher",
      hotspotSlug: "padrao",
      voucher: "ABC123",
      linkLoginOnly: "http://10.0.0.1/login",
      linkLogin: "http://10.0.0.1/login",
      linkOrig: "http://example.com",
      chapId: "\\001",
      chapChallengeB64: Buffer.from("\\002", "utf8").toString("base64"),
    });
  });

  it("accepts null optional fields sent by the portal form", () => {
    expect(
      normalizePortalLoginBody({
        loginType: "voucher",
        hotspotSlug: "padrao",
        codigo: "ABC123",
        voucher: "ABC123",
        cpf: null,
        mac: null,
        ip: null,
        linkLogin: null,
        linkLoginOnly: "http://10.0.0.1/login",
        linkOrig: null,
        chapId: null,
        chapChallenge: null,
        chapIdB64: null,
        chapChallengeB64: null,
      }),
    ).toMatchObject({
      loginType: "voucher",
      hotspotSlug: "padrao",
      codigo: "ABC123",
      voucher: "ABC123",
      cpf: null,
      linkLoginOnly: "http://10.0.0.1/login",
    });
  });
});
