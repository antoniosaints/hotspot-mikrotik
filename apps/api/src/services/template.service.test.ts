import { describe, expect, it } from "vitest";
import {
  buildMikrotikAloginHtml,
  buildMikrotikLoginHtml,
  buildMikrotikLogoutHtml,
  buildMikrotikStatusHtml,
} from "./template.service.js";

describe("buildMikrotikLoginHtml", () => {
  it("preserves MikroTik login fields and computes CHAP base64 fields in the browser", () => {
    const html = buildMikrotikLoginHtml("http://localhost:5173", "padrao");

    expect(html).toContain('method="get"');
    expect(html).toContain('action="http://localhost:5173/portal/padrao"');
    expect(html).not.toContain('action="http://localhost:5173/api/portal/login"');
    expect(html).not.toContain('fetch(form.action, {');
    expect(html).toContain("form.submit();");
    expect(html).not.toContain("ACESSO CAS INTERNET");
    expect(html).not.toContain("Tenho Voucher");
    expect(html).not.toContain("Sou cliente CAS");
    expect(html).toContain('appendHidden("mac", "$(mac)")');
    expect(html).toContain('appendHidden("ip", "$(ip)")');
    expect(html).toContain('appendHidden("link-login", "$(link-login)")');
    expect(html).toContain('appendHidden("link-login-only", "$(link-login-only)")');
    expect(html).toContain('appendHidden("link-orig", "$(link-orig)")');
    expect(html).toContain('appendHidden("error", "$(error)")');
    expect(html).toContain('appendHidden("hotspot", "$(hotspot)")');
    expect(html).toContain('var chapId = "$(chap-id)"');
    expect(html).toContain('var chapChallenge = "$(chap-challenge)"');
    expect(html).toContain('appendHidden("chap-id", chapId)');
    expect(html).toContain('appendHidden("chap-challenge", chapChallenge)');
    expect(html).not.toContain("$(chap-id-b64)");
    expect(html).not.toContain("$(chap-challenge-b64)");
    expect(html).toContain('appendHidden("chap-id-b64", window.btoa(chapId))');
    expect(html).toContain('appendHidden("chap-challenge-b64", window.btoa(chapChallenge))');
  });

  it("builds MikroTik post-login files with RouterOS variables", () => {
    const alogin = buildMikrotikAloginHtml();
    const status = buildMikrotikStatusHtml();
    const logout = buildMikrotikLogoutHtml();

    expect(alogin).toContain("Conectado com sucesso");
    expect(alogin).toContain("$(link-redirect)");
    expect(alogin).toContain("$(link-status)");

    expect(status).toContain("Conexao ativa");
    expect(status).toContain("$(uptime)");
    expect(status).toContain("$(session-time-left)");
    expect(status).toContain("$(link-logout)");

    expect(logout).toContain("Voce saiu da rede");
    expect(logout).toContain("$(link-login)");
    expect(logout).toContain("$(bytes-out-nice)");
  });

  it("uses configured post-login URL when provided", () => {
    const html = buildMikrotikAloginHtml("https://cliente.example.com/inicio?x=1&y=2");

    expect(html).toContain('href="https://cliente.example.com/inicio?x=1&amp;y=2"');
    expect(html).toContain('var redirect = "https://cliente.example.com/inicio?x=1&y=2" || "$(link-redirect)"');
  });
});
