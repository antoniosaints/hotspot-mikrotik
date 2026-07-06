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

// O login e feito por navegacao GET (e nao form POST) porque o portal roda em
// HTTPS e o roteador em HTTP: form POST https->http dispara o aviso
// "informacoes nao protegidas" do navegador; navegacao de nivel superior nao.
// O hotspot MikroTik aceita /login?username=...&password=...&dst=...
export function buildLoginUrl(action: string, fields: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }

  return `${action}${action.includes("?") ? "&" : "?"}${params.toString()}`;
}

function buildRedirectHtml(url: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
  <title>Conectando</title>
</head>
<body>
  <p>Conectando...</p>
  <script>window.location.replace(${JSON.stringify(url)});</script>
  <noscript><a href="${escapeHtml(url)}">Clique aqui para conectar</a></noscript>
</body>
</html>`;
}

export function buildFinalLoginHtml(input: FinalLoginHtmlInput): string {
  const linkLoginOnly = cleanRouterValue(input.linkLoginOnly);
  const linkLogin = cleanRouterValue(input.linkLogin);
  const chapId = cleanRouterValue(input.chapId);
  const chapChallenge = cleanRouterValue(input.chapChallenge);
  const dst = input.dst?.trim() ?? "";

  if (chapId && chapChallenge && linkLoginOnly) {
    const hashedPassword = chapMd5Password(chapId, input.password, chapChallenge);
    const url = buildLoginUrl(linkLoginOnly, {
      username: input.username,
      password: hashedPassword,
      dst,
      popup: "true",
    });

    return buildRedirectHtml(url);
  }

  const action = linkLogin ?? linkLoginOnly;
  if (!action) {
    throw new Error("Login PAP incompleto: linkLogin ou linkLoginOnly deve ser informado.");
  }

  const url = buildLoginUrl(action, {
    username: input.username,
    password: input.password,
    dst,
    popup: "true",
  });

  return buildRedirectHtml(url);
}

function cleanRouterValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  if (!cleaned || cleaned.startsWith("$(")) return undefined;
  return cleaned;
}
