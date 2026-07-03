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

function jsString(value: string) {
  return JSON.stringify(value);
}

export function buildMd5JsUrl(linkLoginOnly: string): string {
  const url = new URL(linkLoginOnly);
  return `${url.protocol}//${url.host}/md5.js`;
}

export function buildFinalLoginHtml(input: FinalLoginHtmlInput): string {
  const linkLoginOnly = cleanRouterValue(input.linkLoginOnly);
  const linkLogin = cleanRouterValue(input.linkLogin);
  const chapId = cleanRouterValue(input.chapId);
  const chapChallenge = cleanRouterValue(input.chapChallenge);
  const dst = input.dst?.trim() ?? "";

  if (chapId && chapChallenge && linkLoginOnly) {
    const md5Url = buildMd5JsUrl(linkLoginOnly);

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Conectando</title>
  <script src="${escapeHtml(md5Url)}"></script>
</head>
<body>
  <form name="sendin" method="post" action="${escapeHtml(linkLoginOnly)}">
    <input type="hidden" name="username" value="${escapeHtml(input.username)}">
    <input type="hidden" name="password" value="">
    <input type="hidden" name="dst" value="${escapeHtml(dst)}">
    <input type="hidden" name="popup" value="true">
  </form>
  <script>
    (function () {
      var form = document.sendin;
      form.password.value = hexMD5(${jsString(chapId)} + ${jsString(input.password)} + ${jsString(chapChallenge)});
      form.submit();
    })();
  </script>
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
