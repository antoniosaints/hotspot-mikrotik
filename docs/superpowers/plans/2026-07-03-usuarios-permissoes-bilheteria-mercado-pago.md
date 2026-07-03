# Usuarios, Permissoes, Bilheteria e Mercado Pago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based admin users, paid access plans, Mercado Pago Pix purchase flow, payment webhook release, and prospect listing.

**Architecture:** Extend the current Fastify/Prisma API with focused auth, billing, payment, and portal contracts while preserving existing CRUD patterns. Frontend changes reuse `CrudPage` where possible and add purpose-built pages only where flow state is richer than CRUD.

**Tech Stack:** Fastify, Prisma SQLite, Zod, Vitest, Vue 3, Vite, Tailwind, Mercado Pago Payments API via backend `fetch`.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`: roles, hotspot payment fields, payment plans, ticket purchases, access type.
- Modify `apps/api/prisma/seed.ts`: seed admin role and active flag.
- Modify `apps/api/src/modules/auth/auth.routes.ts`: token payload includes role, active user checks.
- Create `apps/api/src/modules/auth/permissions.ts`: role definitions and `requireRole` helper.
- Modify `apps/api/src/modules/crud/crud.routes.ts`: permissions per CRUD, users CRUD, Mercado Pago integration fields, payment plans routes.
- Create `apps/api/src/modules/billing/billing.routes.ts`: prospect and purchase admin routes if not covered by CRUD.
- Create `apps/api/src/modules/billing/payment.service.ts`: Pix creation, payment lookup, webhook signature helper.
- Modify `apps/api/src/modules/portal/portal.routes.ts`: portal plan listing, purchase creation, purchase status, final login after release.
- Modify `apps/api/src/modules/dashboard/dashboard.routes.ts`: block disconnect for `user`.
- Modify `apps/api/src/types.ts`: add `COMPRA` login type.
- Add or modify backend tests under `apps/api/src/modules/**`.
- Modify `apps/web/src/services/api.ts`: store and expose current admin profile.
- Modify `apps/web/src/types/hotspot.ts`: roles, plans, purchases, portal purchase data.
- Modify `apps/web/src/router/index.ts`: route metadata permissions and new pages.
- Modify `apps/web/src/layouts/AdminLayout.vue`: role-aware navigation.
- Modify `apps/web/src/pages/IntegracoesPage.vue`: IXC and Mercado Pago fields.
- Modify `apps/web/src/pages/HotspotsPage.vue`: payment integration selection.
- Create `apps/web/src/pages/UsuariosPage.vue`: users management.
- Create `apps/web/src/pages/BilheteriaPage.vue`: payment plan CRUD.
- Create `apps/web/src/pages/ProspeccoesPage.vue`: prospect listing.
- Modify `apps/web/src/pages/PortalPage.vue`: purchase flow and Pix status polling.
- Modify `apps/web/src/pages/DashboardPage.vue`: hide disconnect for `user`.

## Task 1: Roles and Protected Admin Routes

- [ ] Write failing backend tests in `apps/api/src/modules/auth/auth.routes.test.ts` proving `/auth/login` returns `role`, inactive users cannot login, `manager` cannot access `/usuarios`, and `user` cannot disconnect clients.
- [ ] Run `pnpm --filter api test apps/api/src/modules/auth/auth.routes.test.ts` and confirm failures are from missing role/permission behavior.
- [ ] Add `role` and `ativo` to `Admin` in Prisma schema, update seed, token payload and `/auth/me`.
- [ ] Create `permissions.ts` with `AdminRole`, role sets, `requireAnyRole`, and `getAdminPayload`.
- [ ] Gate current routes according to the approved matrix.
- [ ] Run targeted auth/dashboard tests and commit backend permission changes.

## Task 2: Users CRUD

- [ ] Write failing tests proving admin can create/update/deactivate users and cannot remove the last active admin.
- [ ] Implement `/usuarios` admin-only CRUD with bcrypt password hashing and optional password update.
- [ ] Add `UsuariosPage.vue`, route, menu entry, and frontend types.
- [ ] Run targeted backend tests and `pnpm --filter web build`.

## Task 3: Billing Schema and Admin Plans

- [ ] Write failing tests proving active plans are returned for a hotspot and inactive plans are hidden from portal.
- [ ] Add Prisma models `PlanoBilheteria` and `CompraAcesso`, hotspot fields `compraOnline` and `pagamentoIntegracaoId`.
- [ ] Add admin routes for `/planos` and `/prospeccoes`.
- [ ] Add `BilheteriaPage.vue` and `ProspeccoesPage.vue`.
- [ ] Run `pnpm --filter api db:push`, targeted tests, and frontend build.

## Task 4: Mercado Pago Payment Service

- [ ] Write failing tests for Pix payload creation, approved payment lookup handling, and idempotent webhook release.
- [ ] Implement `payment.service.ts` using `fetch` against Mercado Pago `/v1/payments`.
- [ ] Add webhook route `/api/webhooks/mercado-pago` that fetches the payment before trusting status.
- [ ] Add integration type `MERCADO_PAGO`, credential masking, and hotspot payment integration validation.
- [ ] Run targeted payment tests.

## Task 5: Portal Purchase Flow

- [ ] Write failing tests proving purchase without fields generates unique login code and purchase with CPF uses normalized CPF.
- [ ] Extend `/portal/:slug` to include `purchaseEnabled` and active plans.
- [ ] Add `/portal/purchases`, `/portal/purchases/:id/status`, and final login response after release.
- [ ] Update `PortalPage.vue` to choose plan, collect configured fields, show Pix QR/copia-e-cola, poll status, and submit final login.
- [ ] Run portal tests and frontend build.

## Task 6: Verification

- [ ] Run `pnpm --filter api test`.
- [ ] Run `pnpm --filter api build`.
- [ ] Run `pnpm --filter web build`.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check`.
- [ ] Report any unrelated baseline failures separately from feature failures.
