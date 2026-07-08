import type { FastifyInstance, FastifyRequest } from "fastify";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../../config.js";
import { AdminRole, requireAnyRole } from "../auth/permissions.js";

// Diretorio de imagens enviadas pelo painel (logos do portal). Fica junto do
// banco SQLite em apps/api/data para facilitar backup.
const uploadsDir = process.env.UPLOADS_DIR ?? path.resolve("data", "uploads");

const MAX_FILE_BYTES = 3 * 1024 * 1024;

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

const uploadSchema = z.object({
  nome: z.string().min(1),
  dataBase64: z.string().min(1),
});

const fileParamsSchema = z.object({
  name: z.string().regex(/^[\w][\w.-]*$/, "Nome de arquivo invalido."),
});

function sanitizeBaseName(nome: string): string {
  const extension = path.extname(nome).toLowerCase();
  const base = path
    .basename(nome, path.extname(nome))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "imagem"}${extension}`;
}

function publicFileUrl(request: FastifyRequest, name: string): string {
  const origin = config.publicApiUrl ?? `${request.protocol}://${request.headers.host}`;
  return `${origin}/api/uploads/file/${name}`;
}

export async function uploadsRoutes(app: FastifyInstance) {
  const managerPreHandler = [app.authenticate, requireAnyRole(AdminRole.ADMIN, AdminRole.MANAGER)];

  app.get("/uploads", { preHandler: managerPreHandler }, async (request) => {
    await mkdir(uploadsDir, { recursive: true });
    const names = await readdir(uploadsDir);
    const items = await Promise.all(
      names
        .filter((name) => name.toLowerCase() !== ".gitkeep" && contentTypes[path.extname(name).toLowerCase()])
        .map(async (name) => {
          const info = await stat(path.join(uploadsDir, name));
          return {
            name,
            url: publicFileUrl(request, name),
            size: info.size,
            criadoEm: info.mtime.toISOString(),
          };
        }),
    );
    return items.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  });

  app.post("/uploads", { preHandler: managerPreHandler }, async (request, reply) => {
    const parsed = uploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Informe nome e conteudo do arquivo." });
    }

    const extension = path.extname(parsed.data.nome).toLowerCase();
    if (!contentTypes[extension]) {
      return reply.status(400).send({ error: "Formato nao suportado. Use PNG, JPG, WEBP, GIF ou ICO." });
    }

    // Aceita tanto data URL (data:image/png;base64,...) quanto base64 puro.
    const base64 = parsed.data.dataBase64.replace(/^data:[^;]+;base64,/, "");
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      return reply.status(400).send({ error: "Conteudo do arquivo invalido." });
    }

    if (buffer.length === 0) {
      return reply.status(400).send({ error: "Arquivo vazio." });
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return reply.status(400).send({ error: "Arquivo muito grande. Limite de 3 MB." });
    }

    const sanitized = sanitizeBaseName(parsed.data.nome);
    const name = `${Date.now()}-${sanitized}`;
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, name), buffer);

    return reply.status(201).send({
      name,
      url: publicFileUrl(request, name),
      size: buffer.length,
      criadoEm: new Date().toISOString(),
    });
  });

  app.delete("/uploads/:name", { preHandler: managerPreHandler }, async (request, reply) => {
    const params = fileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Nome de arquivo invalido." });
    }

    try {
      await unlink(path.join(uploadsDir, params.data.name));
    } catch {
      return reply.status(404).send({ error: "Arquivo nao encontrado." });
    }

    return { ok: true };
  });

  // Publico: as imagens sao referenciadas pelo portal do cliente.
  app.get("/uploads/file/:name", async (request, reply) => {
    const params = fileParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Nome de arquivo invalido." });
    }

    const contentType = contentTypes[path.extname(params.data.name).toLowerCase()];
    if (!contentType) {
      return reply.status(404).send({ error: "Arquivo nao encontrado." });
    }

    try {
      const content = await readFile(path.join(uploadsDir, params.data.name));
      return reply
        .header("Cache-Control", "public, max-age=86400")
        .type(contentType)
        .send(content);
    } catch {
      return reply.status(404).send({ error: "Arquivo nao encontrado." });
    }
  });
}
