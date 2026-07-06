import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import type { AdminTokenPayload } from "./modules/auth/permissions.js";
import { billingRoutes } from "./modules/billing/billing.routes.js";
import { startExpirationSweep } from "./modules/billing/expiration.service.js";
import { crudRoutes } from "./modules/crud/crud.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { portalRoutes } from "./modules/portal/portal.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AdminTokenPayload;
    user: AdminTokenPayload;
  }
}

export function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    // Atras de Cloudflare/proxy reverso: respeita X-Forwarded-* para que
    // request.protocol/hostname reflitam a URL publica.
    trustProxy: true,
  });

  app.register(cors, {
    origin: "*",
  });
  app.register(sensible);
  app.register(jwt, {
    secret: config.jwtSecret,
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as AdminTokenPayload;
        const admin = await prisma.admin.findUnique({
          where: { id: payload.id },
          select: { ativo: true, role: true },
        });

        if (!admin?.ativo) {
          return reply
            .status(401)
            .send({ error: "Token invalido ou ausente." });
        }

        payload.role = admin.role as AdminTokenPayload["role"];
      } catch {
        reply.status(401).send({ error: "Token invalido ou ausente." });
      }
    },
  );

  app.get("/health", async () => ({ ok: true }));

  app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(crudRoutes);
      await api.register(dashboardRoutes);
      await api.register(billingRoutes);
      await api.register(portalRoutes);
    },
    { prefix: "/api" },
  );

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}

const currentFileUrl = pathToFileURL(process.argv[1] ?? "").href;

async function start() {
  const app = buildServer();

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    const stopExpirationSweep = startExpirationSweep(app.log);
    app.addHook("onClose", async () => {
      stopExpirationSweep();
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (import.meta.url === currentFileUrl) {
  void start();
}
