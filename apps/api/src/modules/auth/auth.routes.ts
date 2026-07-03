import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../db.js";
import { sendZodError } from "../../utils/http.js";
import { AdminRole, type AdminTokenPayload } from "./permissions.js";

const loginSchema = z.object({
  usuario: z.string().min(1),
  senha: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      const admin = await prisma.admin.findUnique({ where: { usuario: body.usuario } });

      if (!admin || !admin.ativo || !(await bcrypt.compare(body.senha, admin.senhaHash))) {
        return reply.status(401).send({ error: "Usuario ou senha invalidos." });
      }

      const role = admin.role as AdminRole;
      const token = app.jwt.sign({ id: admin.id, usuario: admin.usuario, role } satisfies AdminTokenPayload, {
        expiresIn: "8h",
      });
      return {
        token,
        admin: {
          id: admin.id,
          usuario: admin.usuario,
          role,
          ativo: admin.ativo,
          criadoEm: admin.criadoEm,
          atualizadoEm: admin.atualizadoEm,
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return sendZodError(reply, error);
      }

      throw error;
    }
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request) => {
    const payload = request.user as AdminTokenPayload;
    const admin = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, usuario: true, role: true, ativo: true, criadoEm: true, atualizadoEm: true },
    });

    return { admin };
  });

  app.post("/auth/logout", async () => ({
    ok: true,
    message: "Token JWT stateless: descarte o token no cliente para encerrar a sessao.",
  }));
}
