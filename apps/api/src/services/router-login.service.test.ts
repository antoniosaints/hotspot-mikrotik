import { describe, expect, it } from "vitest";
import { buildFinalLoginHtml, buildMd5JsUrl } from "./router-login.service.js";

describe("router-login.service", () => {
  it("builds md5.js URL preserving host port", () => {
    expect(buildMd5JsUrl("http://10.0.0.1:8080/login")).toBe("http://10.0.0.1:8080/md5.js");
  });

  it("builds CHAP form with hashed password calculation only", () => {
    const html = buildFinalLoginHtml({
      linkLoginOnly: "http://10.0.0.1:8080/login",
      linkLogin: "http://10.0.0.1/login",
      username: "ABC123",
      password: "secret",
      dst: "http://example.com",
      chapId: "\\001",
      chapChallenge: "\\002",
    });

    expect(html).toContain('name="sendin"');
    expect(html).toContain('src="http://10.0.0.1:8080/md5.js"');
    expect(html).toContain("hexMD5");
    expect(html).toContain('name="password" value=""');
    expect(html).not.toContain('value="secret"');
  });

  it("rejects incomplete CHAP inputs", () => {
    expect(() =>
      buildFinalLoginHtml({
        linkLoginOnly: "http://10.0.0.1/login",
        username: "ABC123",
        password: "secret",
        chapId: "\\001",
      }),
    ).toThrow("Login CHAP incompleto");
  });
});
