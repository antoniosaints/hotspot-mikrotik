function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildCasShell(title: string, subtitle: string, body: string, script = "") {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background:
        radial-gradient(circle at top, rgba(0, 119, 255, .35), transparent 34%),
        linear-gradient(180deg, #06162d 0%, #07111f 48%, #eef4ff 48%, #eef4ff 100%);
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }
    .app { width: 100%; max-width: 430px; }
    .brand { text-align: center; color: #fff; margin-bottom: 22px; }
    .brand-badge { width: 76px; height: 76px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
    .brand-badge img { width: 100%; }
    .brand h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 0; }
    .brand p { margin: 6px 0 0; font-size: 14px; opacity: .86; }
    .card { background: #fff; border-radius: 28px; padding: 22px; box-shadow: 0 24px 70px rgba(0, 0, 0, .24); }
    .title { margin: 0 0 6px; font-size: 22px; font-weight: 900; color: #0f172a; }
    .subtitle { margin: 0 0 20px; font-size: 14px; color: #6b7280; line-height: 1.4; }
    .grid { display: grid; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 14px; border: 1px solid #e5e7eb; border-radius: 15px; padding: 12px 14px; background: #f9fafb; font-size: 13px; }
    .row span { color: #6b7280; }
    .row strong { color: #111827; text-align: right; word-break: break-word; }
    .primary, .secondary { width: 100%; height: 52px; border: 0; border-radius: 16px; font-weight: 800; cursor: pointer; text-decoration: none; display: flex; align-items: center; justify-content: center; }
    .primary { margin-top: 18px; background: linear-gradient(135deg, #0077ff, #004aad); color: #fff; box-shadow: 0 14px 28px rgba(0, 119, 255, .25); }
    .secondary { margin-top: 10px; background: #eef2f7; color: #374151; }
    .success { width: 54px; height: 54px; border-radius: 18px; display: grid; place-items: center; margin-bottom: 14px; background: #eaf3ff; color: #0077ff; font-size: 28px; font-weight: 900; }
    .footer { text-align: center; margin-top: 14px; color: #94a3b8; font-size: 12px; }
    @media (min-width: 768px) {
      .card { padding: 28px; }
      .brand h1 { font-size: 30px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="brand">
      <div class="brand-badge">
        <img src="${escapeHtml("https://portal.cas.net.br/assets/logo_branca.png")}" alt="Logo CAS Internet">
      </div>
      <h1>ACESSO CAS INTERNET</h1>
      <p>Conecte-se a internet de forma rapida e segura</p>
    </section>
    <section class="card">
      <div class="success">✓</div>
      <h2 class="title">${escapeHtml(title)}</h2>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      ${body}
    </section>
    <div class="footer">CAS Internet - Acesso Hotspot</div>
  </main>
  ${script}
</body>
</html>`;
}

export function buildMikrotikLoginHtml(baseUrl: string, hotspotSlug: string): string {
  const portalUrl = new URL(`/portal/${encodeURIComponent(hotspotSlug)}`, baseUrl).toString();

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecionando</title>
  <style>
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background: #07111f;
      color: #fff;
      font-family: Arial, Helvetica, sans-serif;
    }

    .status {
      text-align: center;
      font-size: 14px;
      opacity: .82;
    }
  </style>
</head>
<body>
  <form id="hotspot-login" method="get" action="${escapeHtml(portalUrl)}"></form>
  <div class="status">Redirecionando para o portal...</div>

  <script>
    (function () {
      var form = document.getElementById("hotspot-login");

      function appendHidden(name, value) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value || "";
        form.appendChild(input);
      }

      appendHidden("mac", "$(mac)");
      appendHidden("ip", "$(ip)");
      appendHidden("link-login", "$(link-login)");
      appendHidden("link-login-only", "$(link-login-only)");
      appendHidden("link-orig", "$(link-orig)");
      appendHidden("error", "$(error)");
      appendHidden("hotspot", "$(hotspot)");

      var chapId = "$(chap-id)";
      var chapChallenge = "$(chap-challenge)";
      var hasChap = chapId && chapChallenge && chapId.indexOf("$(") !== 0 && chapChallenge.indexOf("$(") !== 0;

      if (hasChap) {
        appendHidden("chap-id", chapId);
        appendHidden("chap-challenge", chapChallenge);
      }

      if (hasChap && typeof window.btoa === "function") {
        try {
          appendHidden("chap-id-b64", window.btoa(chapId));
          appendHidden("chap-challenge-b64", window.btoa(chapChallenge));
        } catch (error) {}
      }

      form.submit();
    })();
  </script>
</body>
</html>`;
}

export function buildMikrotikAloginHtml(urlPosLogin = ""): string {
  const configuredRedirect = urlPosLogin.trim();
  const initialRedirect = configuredRedirect ? escapeHtml(configuredRedirect) : "$(link-redirect)";
  const scriptRedirect = JSON.stringify(configuredRedirect);

  return buildCasShell(
    "Conectado com sucesso",
    "Seu acesso foi liberado. Voce sera redirecionado automaticamente.",
    `<div class="grid">
        <div class="row"><span>Usuario</span><strong>$(username)</strong></div>
        <div class="row"><span>IP</span><strong>$(ip)</strong></div>
        <div class="row"><span>MAC</span><strong>$(mac)</strong></div>
      </div>
      <a class="primary" id="continue-link" href="${initialRedirect}">Continuar navegando</a>
      <a class="secondary" href="$(link-status)">Ver status da conexao</a>`,
    `<script>
      (function () {
        var redirect = ${scriptRedirect} || "$(link-redirect)";
        if (!redirect || redirect.indexOf("$(") === 0) {
          redirect = "$(link-status)";
        }
        document.getElementById("continue-link").href = redirect;
        window.setTimeout(function () {
          window.location.href = redirect;
        }, 1800);
      })();
    </script>`,
  );
}

export function buildMikrotikStatusHtml(): string {
  return buildCasShell(
    "Conexao ativa",
    "Acompanhe os dados atuais do seu acesso.",
    `<div class="grid">
        <div class="row"><span>Usuario</span><strong>$(username)</strong></div>
        <div class="row"><span>IP</span><strong>$(ip)</strong></div>
        <div class="row"><span>MAC</span><strong>$(mac)</strong></div>
        <div class="row"><span>Tempo conectado</span><strong>$(uptime)</strong></div>
        <div class="row"><span>Tempo restante</span><strong>$(session-time-left)</strong></div>
        <div class="row"><span>Download</span><strong>$(bytes-out-nice)</strong></div>
        <div class="row"><span>Upload</span><strong>$(bytes-in-nice)</strong></div>
      </div>
      <a class="primary" href="$(link-logout)">Sair da rede</a>
      <a class="secondary" href="$(link-redirect)">Continuar navegando</a>`,
  );
}

export function buildMikrotikLogoutHtml(): string {
  return buildCasShell(
    "Voce saiu da rede",
    "Sua sessao foi encerrada com sucesso.",
    `<div class="grid">
        <div class="row"><span>Usuario</span><strong>$(username)</strong></div>
        <div class="row"><span>IP</span><strong>$(ip)</strong></div>
        <div class="row"><span>MAC</span><strong>$(mac)</strong></div>
        <div class="row"><span>Tempo conectado</span><strong>$(uptime)</strong></div>
        <div class="row"><span>Download</span><strong>$(bytes-out-nice)</strong></div>
        <div class="row"><span>Upload</span><strong>$(bytes-in-nice)</strong></div>
      </div>
      <a class="primary" href="$(link-login)">Conectar novamente</a>`,
  );
}
