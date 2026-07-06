# Plano — Bilheteria com Mercado Pago (extensão de sessão sem desconexão)

Objetivo: cliente compra tempo no portal, paga via PIX e, na aprovação, o tempo
da sessão é ajustado para o valor comprado **sem desconectar o dispositivo**.

Estratégia escolhida: **a API controla o tempo**. O usuário loga no MikroTik sem
`limit-uptime` (a sessão ativa não tem contagem regressiva no router) e a API é
quem decide quando desconectar — tanto no fim da janela de pagamento quanto no
fim do tempo comprado. Assim, aprovar o pagamento não exige nenhuma alteração
na sessão ativa: ela simplesmente continua.

## Fase 0 — Destravar o pagamento em produção

O webhook do Mercado Pago hoje quase certamente não chega:

- `notification_url` é montada com `request.hostname`/`request.protocol`, e o
  Fastify roda atrás de Cloudflare + proxy **sem `trustProxy`** → a URL enviada
  ao MP sai com o hostname interno do container.

Ações:

1. `trustProxy: true` no `buildServer()`.
2. Nova env `PUBLIC_API_URL` (ex.: `https://apihotspot.cas.net.br`); a
   `notification_url` passa a ser `${PUBLIC_API_URL}/api/webhooks/mercado-pago`,
   com fallback no comportamento atual.
3. Validar a assinatura `x-signature` do webhook usando o campo `chaveWebhook`
   já existente (HMAC-SHA256 no formato do MP: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`).
4. **Reconciliação (fallback do webhook)**: o `GET /portal/purchases/:id/status`,
   quando a compra está PENDENTE e tem `mercadoPagoPaymentId`, consulta o MP
   diretamente e libera a compra se aprovada. Como o portal já faz polling
   desse endpoint, a compra destrava mesmo se o webhook falhar. Guardar
   `ultimaVerificacaoEm` para limitar a 1 consulta ao MP a cada ~10s por compra.

## Fase 1 — Usuário único (sem troca no final)

Hoje: usuário temporário `PAY...` (4 min) durante o pagamento e um usuário novo
criado na liberação → re-login → desconexão.

Novo fluxo: as credenciais definitivas (ticket) são geradas na criação da
compra. O endpoint de acesso temporário loga o cliente já com o usuário
definitivo, criado no MikroTik **sem `limit-uptime`**, comment
`Hotspot COMPRA_PENDENTE`. Não existe mais troca de usuário.

Schema (`CompraAcesso`), campos novos:

- `janelaExpiraEm  DateTime?` — fim da janela de pagamento (ex.: agora + 10 min)
- `tempoExpiraEm   DateTime?` — fim do tempo comprado (preenchido na aprovação)
- `ultimaVerificacaoEm DateTime?` — controle da reconciliação

## Fase 2 — Aprovação sem tocar na sessão

`releasePurchase` passa a:

1. Atualizar o usuário existente no MikroTik (novo `updateHotspotUser` no
   `mikrotik.service`): comment → `Hotspot COMPRA` e `limit-uptime` =
   tempo comprado + folga (só vale para **relogins**; a sessão ativa não é
   afetada — é a rede de segurança caso a API caia).
2. Calcular `tempoExpiraEm = agora + tempoMinutos` e criar o `Acesso` com esse
   `expiraEm`.
3. Não criar usuário novo, não derrubar sessão: **zero desconexão**.

## Fase 3 — Scheduler de expiração na API

Job interno (`setInterval` 30–60s, iniciado no `start()` e executado também no
boot para recuperar atrasos):

- Compras PENDENTE com `janelaExpiraEm < agora` → status `EXPIRADA`, remover o
  usuário do MikroTik e derrubar a sessão ativa (`/ip/hotspot/active`).
- Acessos LIBERADO com `expiraEm < agora` → derrubar sessão ativa e remover o
  usuário; marcar o acesso como encerrado.
- Cada item tratado com try/catch individual + log (falha em um não trava os
  demais; router inacessível → tenta no próximo ciclo).

Risco aceito: se a API ficar fora do ar, não pagantes navegam até ela voltar
(janela curta) e pagantes têm o `limit-uptime` de folga como teto.

## Fase 4 — UX do portal

- Pagamento aprovado com cliente ainda conectado: mostrar "Pagamento confirmado,
  seu tempo foi liberado" — sem redirect, sem re-login.
- `final-login` vira recuperação: usado apenas se o cliente caiu/fechou antes
  da aprovação (loga de novo com as credenciais definitivas).

## Testes e rollout

- Unit: reconciliação de status, assinatura do webhook, `updateHotspotUser`,
  scheduler com fake timers, novos caminhos do `releasePurchase`.
- Ajustar os testes existentes de billing (fluxo de usuário único).
- Rollout: `prisma db push` → deploy com `PUBLIC_API_URL` configurada → compra
  real de valor mínimo validando: webhook chega OU reconciliação libera; sessão
  não cai na aprovação; corte acontece no fim do tempo; janela expira para não
  pagantes.
