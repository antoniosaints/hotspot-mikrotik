# Node Vue SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active PHP hotspot system with a Node.js API, Vue.js admin/portal UI, and SQLite database while preserving MikroTik voucher, CPF, CHAP, and admin workflows.

**Architecture:** Build a pnpm monorepo with `apps/api` for Fastify + Prisma + SQLite and `apps/web` for Vue 3 + Vite + Tailwind/shadcn-style components. Move the PHP implementation into `legacy-php/` so the active root contains only the new stack.

**Tech Stack:** Node.js, TypeScript, pnpm workspaces, Fastify, Prisma, SQLite, Vue 3, Vite, Tailwind CSS, shadcn-vue-style components, Zod, bcryptjs, JWT, Recharts-compatible SVG charts via Vue components.

---

### Task 1: Preserve Legacy and Create Monorepo Skeleton

**Files:**
- Move: `admin/`, `app/`, `public/`, `tests/`, `database.sql`, `database_upgrade_multi_hotspot.sql`
- Create: `legacy-php/`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `packages/shared/package.json`

- [ ] **Step 1: Move the PHP implementation into legacy**

Run these PowerShell commands from `C:\Users\Usuario\Desktop\Projetos\Hotspot`:

```powershell
New-Item -ItemType Directory -Force legacy-php
Move-Item -LiteralPath admin,app,public,tests,database.sql,database_upgrade_multi_hotspot.sql -Destination legacy-php
```

Expected: active PHP folders/files are under `legacy-php/`.

- [ ] **Step 2: Create root workspace files**

Create `package.json`:

```json
{
  "name": "mikrotik-hotspot",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
*.log
apps/api/data/*.sqlite
apps/api/data/*.sqlite-journal
apps/api/prisma/migrations/
```

- [ ] **Step 3: Create package manifests**

Create `apps/api/package.json` with scripts for `dev`, `build`, `start`, `test`, `lint`, `db:push`, `db:seed`, and Prisma dependencies.

Create `apps/web/package.json` with scripts for `dev`, `build`, `preview`, `test`, `lint`, Vue/Vite/Tailwind dependencies.

Create `packages/shared/package.json` exporting shared TypeScript types.

- [ ] **Step 4: Verify skeleton**

Run:

```powershell
pnpm install
pnpm -r --if-present lint
```

Expected: dependencies install and empty lint scripts do not block.

### Task 2: Backend Database and Seed

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/types.ts`

- [ ] **Step 1: Define Prisma schema**

Create models `Admin`, `Local`, `Mikrotik`, `Hotspot`, `Voucher`, `CpfLogin`, and `Acesso` matching the approved spec. Use SQLite provider and `DATABASE_URL="file:./data/hotspot.sqlite"`.

- [ ] **Step 2: Seed initial data**

Seed admin `admin` with bcrypt hash for `admin123`, plus one default local, inactive MikroTik, and default hotspot.

- [ ] **Step 3: Add DB/config helpers**

`db.ts` exports a singleton `PrismaClient`. `config.ts` reads `PORT`, `JWT_SECRET`, `WEB_ORIGIN`, and `DATABASE_URL`.

- [ ] **Step 4: Verify database**

Run:

```powershell
pnpm --filter api db:push
pnpm --filter api db:seed
```

Expected: SQLite file is created and seed completes without errors.

### Task 3: Backend Core API

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Create: `apps/api/src/modules/crud/crud.routes.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Create: `apps/api/src/modules/portal/portal.routes.ts`
- Create: `apps/api/src/services/template.service.ts`
- Create: `apps/api/src/services/router-login.service.ts`
- Create: `apps/api/src/services/mikrotik.service.ts`

- [ ] **Step 1: Create Fastify server**

Register CORS, cookie/JWT auth, JSON routes under `/api`, static health route `/health`, and HTML portal routes under `/portal`.

- [ ] **Step 2: Implement auth**

`POST /api/auth/login` verifies bcrypt password and returns a token/session. `GET /api/auth/me` returns current admin. `POST /api/auth/logout` clears auth state.

- [ ] **Step 3: Implement CRUD routes**

Expose list/create/update/delete for:

```text
/api/locais
/api/mikrotiks
/api/hotspots
/api/vouchers
/api/cpf-logins
```

Validate bodies with Zod. Voucher generation accepts `hotspotId`, `quantidade`, and `tempoMinutos`.

- [ ] **Step 4: Implement dashboard**

`GET /api/dashboard` returns totals, used/available voucher counts, access counts by day, access counts by type, and recent accesses.

- [ ] **Step 5: Implement MikroTik service**

Create methods:

```ts
createHotspotUser(config, username, password, minutes, profile): Promise<void>
removeHotspotUser(config, username): Promise<void>
testConnection(config): Promise<boolean>
```

If the RouterOS package is not available or connection fails, return explicit API errors.

- [ ] **Step 6: Implement portal and CHAP services**

`template.service.ts` exports `buildMikrotikLoginHtml(baseUrl, hotspotSlug)`.

`router-login.service.ts` exports `buildFinalLoginHtml({ linkLoginOnly, username, password, dst, chapId, chapChallenge })` and loads `md5.js` from the MikroTik host.

`POST /api/portal/login` validates voucher or CPF, creates MikroTik user, records access, and returns final HTML for RouterOS login.

- [ ] **Step 7: Verify backend**

Run:

```powershell
pnpm --filter api build
pnpm --filter api test
```

Expected: TypeScript compiles and route/service tests pass.

### Task 4: Frontend Shell and UI System

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/router/index.ts`
- Create: `apps/web/src/assets/main.css`
- Create: `apps/web/src/components/ui/*.vue`
- Create: `apps/web/src/layouts/AdminLayout.vue`
- Create: `apps/web/src/services/api.ts`

- [ ] **Step 1: Create Vite Vue app**

Use Vue 3 with TypeScript. Configure Tailwind with dark mode class and blue primary tokens.

- [ ] **Step 2: Add shadcn-style UI primitives**

Create local Vue components for Button, Input, Label, Card, Dialog, Table, Badge, Select, Tabs, DropdownMenu, and Alert using Tailwind classes compatible with shadcn-vue patterns.

- [ ] **Step 3: Add admin layout**

Create a dark sidebar with navigation for Dashboard, Locais, MikroTiks, Hotspots, Vouchers, Logins CPF, Configuracao MikroTik, and Logout.

- [ ] **Step 4: Add API client**

Create typed `api.ts` wrapper for `fetch`, attaching auth token and surfacing API errors.

- [ ] **Step 5: Verify frontend shell**

Run:

```powershell
pnpm --filter web build
```

Expected: Vite build succeeds.

### Task 5: Frontend Pages

**Files:**
- Create: `apps/web/src/pages/LoginPage.vue`
- Create: `apps/web/src/pages/DashboardPage.vue`
- Create: `apps/web/src/pages/CrudPage.vue`
- Create: `apps/web/src/pages/LocaisPage.vue`
- Create: `apps/web/src/pages/MikrotiksPage.vue`
- Create: `apps/web/src/pages/HotspotsPage.vue`
- Create: `apps/web/src/pages/VouchersPage.vue`
- Create: `apps/web/src/pages/CpfLoginsPage.vue`
- Create: `apps/web/src/pages/MikrotikConfigPage.vue`
- Create: `apps/web/src/pages/PortalPage.vue`

- [ ] **Step 1: Implement login**

Login page posts to `/api/auth/login`, stores auth state, and redirects to `/dashboard`.

- [ ] **Step 2: Implement dashboard**

Show KPIs, connection chart, login-type chart, and recent access table.

- [ ] **Step 3: Implement CRUD pages**

Each CRUD page uses responsive tables and modal forms for create/edit. Each row has edit and delete actions.

- [ ] **Step 4: Implement vouchers**

Add batch generation modal with hotspot, quantity, and minutes. List vouchers with status, MAC, IP, used date, edit, and delete.

- [ ] **Step 5: Implement CPF logins**

Modal form asks name, CPF, phone, hotspot, minutes, active status. List supports edit/delete.

- [ ] **Step 6: Implement MikroTik config**

Show step-by-step RouterOS terminal commands for API, profile login protocols, walled garden, upload of `login.html`, and `md5.js` requirement.

- [ ] **Step 7: Implement portal page**

Render captive login with voucher/CPF tabs according to hotspot configuration. Preserve MikroTik query params and submit to `/api/portal/login`.

- [ ] **Step 8: Verify pages**

Run:

```powershell
pnpm --filter web build
```

Expected: build succeeds with all routes included.

### Task 6: README and End-to-End Verification

**Files:**
- Replace: `README.md`

- [ ] **Step 1: Rewrite README**

Document:

```text
pnpm install
pnpm --filter api db:push
pnpm --filter api db:seed
pnpm dev
```

Include default admin, SQLite path, MikroTik API commands, walled garden, HTTP CHAP/PAP notes, md5.js requirement, and login.html export workflow.

- [ ] **Step 2: Run full verification**

Run:

```powershell
pnpm install
pnpm --filter api db:push
pnpm --filter api db:seed
pnpm build
pnpm test
```

Expected: install, DB setup, build, and tests pass.

- [ ] **Step 3: Start dev servers**

Run:

```powershell
pnpm dev
```

Expected:

```text
API: http://localhost:3000
Web: http://localhost:5173
```

Open `http://localhost:5173/login` and confirm the admin screen loads.

