# Migracao para Node.js, Vue.js e SQLite

## Objetivo

Substituir totalmente o sistema PHP atual por um monorepo Node.js + Vue.js usando SQLite como banco de dados e shadcn-vue como base visual. O sistema novo deve manter as funcionalidades ja existentes do hotspot MikroTik e remover o PHP do fluxo ativo.

## Escopo

- Criar monorepo com `apps/api`, `apps/web` e `packages/shared`.
- Implementar API Node.js para admin, portal captive e integracao MikroTik.
- Implementar frontend Vue 3 com Vite, Tailwind CSS e componentes shadcn-vue.
- Usar SQLite local como banco principal.
- Preservar login por voucher e CPF.
- Preservar CRUDs de locais, MikroTiks, hotspots, vouchers e logins CPF.
- Preservar dashboard com KPIs e graficos.
- Preservar export de `login.html` para MikroTik.
- Preservar fluxo CHAP usando `md5.js` servido pelo proprio MikroTik.
- Mover o PHP antigo para `legacy-php/` ou remover do fluxo ativo.

## Fora do Escopo Inicial

- Multi-tenant com isolamento por empresa.
- Pagamentos online.
- Radius.
- Docker obrigatorio.
- Deploy em nuvem.

## Estrutura Alvo

```text
Hotspot/
+-- apps/
|   +-- api/
|   |   +-- prisma/
|   |   |   +-- schema.prisma
|   |   |   +-- seed.ts
|   |   +-- src/
|   |       +-- modules/
|   |       |   +-- auth/
|   |       |   +-- dashboard/
|   |       |   +-- locais/
|   |       |   +-- mikrotiks/
|   |       |   +-- hotspots/
|   |       |   +-- vouchers/
|   |       |   +-- cpf-logins/
|   |       |   +-- portal/
|   |       +-- services/
|   |       |   +-- mikrotik.service.ts
|   |       |   +-- router-login.service.ts
|   |       |   +-- template.service.ts
|   |       +-- server.ts
|   +-- web/
|       +-- src/
|           +-- components/
|           +-- components/ui/
|           +-- layouts/
|           +-- pages/
|           +-- router/
|           +-- services/
+-- packages/
|   +-- shared/
+-- legacy-php/
+-- package.json
+-- pnpm-workspace.yaml
+-- README.md
```

## Backend

Usar Fastify em `apps/api` por ser leve, rapido e adequado para uma API sem framework fullstack. A API deve expor rotas JSON para o painel administrativo e rotas HTML especificas para o fluxo captive quando necessario.

Principais modulos:

- `auth`: login admin, logout e sessao/JWT.
- `dashboard`: KPIs, contagem de vouchers, conexoes e acessos recentes.
- `locais`: CRUD de locais.
- `mikrotiks`: CRUD de roteadores e teste de conexao.
- `hotspots`: CRUD de portais e vinculo com local + MikroTik.
- `vouchers`: geracao em lote, listagem, edicao, exclusao e status.
- `cpf-logins`: cadastro de nome, CPF, telefone, tempo e status.
- `portal`: validacao de voucher/CPF, criacao do usuario no MikroTik, registro de acesso e resposta final de login.

## Banco de Dados

Usar Prisma com SQLite. O arquivo do banco deve ficar em `apps/api/data/hotspot.sqlite`.

Modelos:

- `Admin`: usuario, hash da senha, timestamps.
- `Local`: nome, descricao, status.
- `Mikrotik`: nome, host, usuario API, senha API, porta, profile padrao, status.
- `Hotspot`: nome, slug, URL publica, local, MikroTik, login voucher ativo, login CPF ativo, status.
- `Voucher`: codigo, tempo em minutos, usado, MAC, IP, usado em, hotspot, timestamps.
- `CpfLogin`: nome, CPF normalizado, telefone, tempo, ativo, usado em, hotspot.
- `Acesso`: tipo, codigo/login, MAC, IP, login em, expira em, status, hotspot, MikroTik.

Seed inicial:

- Admin `admin`.
- Senha `admin123` armazenada com hash.
- Um local padrao.
- Um MikroTik exemplo inativo.
- Um hotspot padrao.

## Frontend

Usar Vue 3 + Vite + TypeScript + Tailwind CSS + shadcn-vue. A interface deve continuar com tema dark, azul como cor primaria, layouts responsivos, modais para formularios de CRUD e tabelas com acoes de editar/apagar.

Paginas:

- `/login`: login administrativo.
- `/dashboard`: KPIs, graficos de conexoes e acessos recentes.
- `/locais`: CRUD em modal.
- `/mikrotiks`: CRUD em modal, teste de conexao e comandos de configuracao.
- `/hotspots`: CRUD em modal, vinculos e configuracoes de login.
- `/vouchers`: geracao em lote, lista, edicao, exclusao e status usado/disponivel.
- `/logins`: cadastro de nome, CPF, telefone e tempo.
- `/portal/:slug`: tela captive do cliente.

## Fluxo Captive MikroTik

O arquivo `login.html` exportado pelo sistema deve redirecionar o cliente para o portal Vue/API preservando:

- `mac`
- `ip`
- `link-login`
- `link-login-only`
- `link-orig`
- `error`
- `chap-id`
- `chap-challenge`
- `hotspot`

Depois da validacao do voucher ou CPF, a API cria o usuario hotspot no MikroTik via API RouterOS. Em seguida, responde com uma pagina HTML final que:

- usa `form name="sendin"`;
- carrega `md5.js` a partir do host do MikroTik;
- calcula `hexMD5(chapId + senha + chapChallenge)` quando CHAP estiver ativo;
- envia para `link-login-only`;
- nunca envia senha pura quando CHAP estiver ativo.

## Integracao MikroTik

Criar um service dedicado para RouterOS API com:

- conexao configuravel por MikroTik cadastrado;
- criacao de usuario hotspot;
- remocao de usuario hotspot;
- teste de conexao;
- uso de `limit-uptime`;
- uso do profile definido no hotspot/MikroTik.

## Seguranca

- Senhas de admin com `bcrypt`.
- API protegida por sessao HTTP-only ou JWT armazenado com cuidado no frontend.
- Validacao de entrada com Zod no backend.
- CPF normalizado antes de persistir.
- Credenciais de MikroTik nunca expostas no frontend.
- CORS restrito ao frontend local/configurado.
- Vouchers usados nao devem poder ser reutilizados.

## Migracao do Projeto Atual

Como a decisao e substituir totalmente, o PHP sera retirado do fluxo ativo. Para preservar referencia durante a transicao, os arquivos atuais podem ser movidos para `legacy-php/`. O novo README deve documentar apenas a stack Node/Vue/SQLite, mantendo uma nota de que o legado PHP esta preservado para consulta.

## Criterios de Aceitacao

- `pnpm install` instala o monorepo.
- `pnpm dev` sobe API e web.
- `pnpm --filter api db:push` cria o SQLite.
- `pnpm --filter api db:seed` cria admin inicial.
- Admin consegue logar.
- Dashboard carrega KPIs.
- CRUDs de locais, MikroTiks, hotspots, vouchers e logins CPF funcionam com editar/apagar.
- Vouchers podem ser gerados em lote.
- Portal por voucher valida, cria usuario no MikroTik e registra acesso.
- Portal por CPF valida, cria usuario no MikroTik e registra acesso.
- Export de `login.html` inclui parametros CHAP.
- Fluxo final CHAP usa `md5.js` do MikroTik.
- README possui passo a passo de instalacao e configuracao MikroTik.
