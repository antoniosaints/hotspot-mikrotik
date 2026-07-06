import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFinalLoginHtml, buildLoginUrl, chapMd5Password } from "./router-login.service.js";

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

  it("appends login params preserving an existing query string", () => {
    expect(buildLoginUrl("http://10.0.0.1/login", { username: "A B", dst: "http://x/?a=1" })).toBe(
      "http://10.0.0.1/login?username=A+B&dst=http%3A%2F%2Fx%2F%3Fa%3D1",
    );
    expect(buildLoginUrl("http://10.0.0.1/login?foo=1", { username: "AB" })).toBe(
      "http://10.0.0.1/login?foo=1&username=AB",
    );
  });

  it("builds a GET redirect with server-side CHAP hash and no external md5.js", () => {
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

    expect(html).toContain("http://10.0.0.1:8080/login?username=ABC123");
    expect(html).toContain(`password=${expectedHash}`);
    expect(html).toContain("window.location.replace(");
    expect(html).toContain('http-equiv="refresh"');
    expect(html).not.toContain("md5.js");
    expect(html).not.toContain("hexMD5");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("password=secret");
  });

  it("falls back to plain-password GET redirect when CHAP inputs are incomplete", () => {
    const html = buildFinalLoginHtml({
      linkLoginOnly: "http://10.0.0.1/login",
      username: "ABC123",
      password: "secret",
      chapId: CHAP_ID,
    });

    expect(html).toContain("http://10.0.0.1/login?username=ABC123&password=secret");
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

    expect(html).toContain("http://10.0.0.1/login?username=ABC123&password=secret");
    expect(html).not.toContain("$(chap-id)");
  });
});
