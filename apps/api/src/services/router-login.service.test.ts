import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFinalLoginHtml, chapMd5Password } from "./router-login.service.js";

const CHAP_ID = "ô";
const CHAP_CHALLENGE = Buffer.from("zsC6gTOc8b73lPKE2HjcMQ==", "base64").toString("latin1");

describe("router-login.service", () => {
  it("computes the CHAP MD5 over raw latin1 bytes like MikroTik md5.js", () => {
    const expected = createHash("md5")
      .update(Buffer.from(CHAP_ID + "secret" + CHAP_CHALLENGE, "latin1"))
      .digest("hex");

    expect(chapMd5Password(CHAP_ID, "secret", CHAP_CHALLENGE)).toBe(expected);
    expect(chapMd5Password(CHAP_ID, "secret", CHAP_CHALLENGE)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("builds CHAP form with server-side hashed password and no external md5.js", () => {
    const html = buildFinalLoginHtml({
      linkLoginOnly: "http://10.0.0.1:8080/login",
      linkLogin: "http://10.0.0.1/login",
      username: "ABC123",
      password: "secret",
      dst: "http://example.com",
      chapId: CHAP_ID,
      chapChallenge: CHAP_CHALLENGE,
    });

    const expectedHash = chapMd5Password(CHAP_ID, "secret", CHAP_CHALLENGE);

    expect(html).toContain('name="sendin"');
    expect(html).toContain('action="http://10.0.0.1:8080/login"');
    expect(html).toContain(`name="password" value="${expectedHash}"`);
    expect(html).not.toContain("md5.js");
    expect(html).not.toContain("hexMD5");
    expect(html).not.toContain('value="secret"');
  });

  it("falls back to regular login when CHAP inputs are incomplete", () => {
    const html = buildFinalLoginHtml({
      linkLoginOnly: "http://10.0.0.1/login",
      username: "ABC123",
      password: "secret",
      chapId: CHAP_ID,
    });

    expect(html).toContain('action="http://10.0.0.1/login"');
    expect(html).toContain('name="password" value="secret"');
    expect(html).not.toContain("hexMD5");
  });

  it("ignores MikroTik placeholders that were not replaced", () => {
    const html = buildFinalLoginHtml({
      linkLoginOnly: "http://10.0.0.1/login",
      username: "ABC123",
      password: "secret",
      chapId: "$(chap-id)",
      chapChallenge: "$(chap-challenge)",
    });

    expect(html).toContain('name="password" value="secret"');
    expect(html).not.toContain("hexMD5");
    expect(html).not.toContain("$(chap-id)");
  });
});
