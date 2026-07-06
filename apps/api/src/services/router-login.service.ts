import { createHash } from "node:crypto";

export type FinalLoginHtmlInput = {
  linkLoginOnly?: string | null;
  linkLogin?: string | null;
  username: string;
  password: string;
  dst?: string | null;
  chapId?: string | null;
  chapChallenge?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Resposta CHAP do hotspot MikroTik: MD5(chap-id + senha + chap-challenge),
// tratando cada char como um byte (latin1, 0x00-0xFF) — o mesmo resultado do
// hexMD5 do md5.js servido pelo roteador. Calcular no servidor elimina o
// <script src="http://<roteador>/md5.js">, que o navegador bloqueia como
// mixed content quando o portal roda em HTTPS.
export function chapMd5Password(chapId: string, password: string, chapChallenge: string): string {
  return createHash("md5")
    .update(Buffer.from(chapId + password + chapChallenge, "latin1"))
    .digest("hex");
}

export function buildFinalLoginHtml(input: FinalLoginHtmlInput): string {
  const linkLoginOnly = cleanRouterValue(input.linkLoginOnly);
  const linkLogin = cleanRouterValue(input.linkLogin);
  const chapId = cleanRouterValue(input.chapId);
  const chapChallenge = cleanRouterValue(input.chapChallenge);
  const dst = input.dst?.trim() ?? "";

  if (chapId && chapChallenge && linkLoginOnly) {
    const hashedPassword = chapMd5Password(chapId, input.password, chapChallenge);

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Conectando</title>
</head>
<body>
  <form name="sendin" method="post" action="${escapeHtml(linkLoginOnly)}">
    <input type="hidden" name="username" value="${escapeHtml(input.username)}">
    <input type="hidden" name="password" value="${hashedPassword}">
    <input type="hidden" name="dst" value="${escapeHtml(dst)}">
    <input type="hidden" name="popup" value="true">
  </form>
  <script>document.sendin.submit();</script>
</body>
</html>`;
  }

  const action = linkLogin ?? linkLoginOnly;
  if (!action) {
    throw new Error("Login PAP incompleto: linkLogin ou linkLoginOnly deve ser informado.");
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Conectando</title>
</head>
<body>
  <form id="sendin" method="post" action="${escapeHtml(action)}">
    <input type="hidden" name="username" value="${escapeHtml(input.username)}">
    <input type="hidden" name="password" value="${escapeHtml(input.password)}">
    <input type="hidden" name="dst" value="${escapeHtml(dst)}">
    <input type="hidden" name="popup" value="true">
  </form>
  <script>document.getElementById("sendin").submit();</script>
</body>
</html>`;
}

function cleanRouterValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.startsWith("$(")) return undefined;
  return cleaned;
}
