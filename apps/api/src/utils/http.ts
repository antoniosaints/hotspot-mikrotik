import type { FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodTypeAny } from "zod";

export function parseBody<TSchema extends ZodTypeAny>(schema: TSchema, value: unknown) {
  return schema.parse(value) as ReturnType<TSchema["parse"]>;
}

export function sendZodError(reply: FastifyReply, error: ZodError) {
  const firstIssue = error.issues[0];
  const field = firstIssue?.path.join(".");
  const message = firstIssue ? translateZodIssue(firstIssue.code, field, firstIssue.message) : "Dados invalidos.";

  return reply.status(400).send({
    error: message,
    issues: error.issues.map((issue) => ({
      ...issue,
      message: translateZodIssue(issue.code, issue.path.join("."), issue.message),
    })),
  });
}

function translateZodIssue(code: string, field: string | undefined, fallback: string) {
  const label = field ? fieldLabels[field] ?? field : "campo";

  if (code === "invalid_string" && fallback.toLowerCase().includes("email")) {
    return `Informe um email valido${field ? ` em ${label}` : ""}.`;
  }

  if (code === "too_small") {
    return `Preencha o campo ${label}.`;
  }

  if (code === "invalid_type") {
    return `Valor invalido para ${label}.`;
  }

  return fallback === "Required" ? `Preencha o campo ${label}.` : fallback;
}

const fieldLabels: Record<string, string> = {
  email: "email",
  nome: "nome",
  telefone: "telefone",
  cpf: "CPF",
  endereco: "endereco",
  hotspotSlug: "hotspot",
  planoId: "plano",
  usuario: "usuario",
  senha: "senha",
};

export function sendCrudError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return sendZodError(reply, error);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return reply.status(400).send({
        error: "Nao foi possivel concluir a operacao porque existem registros vinculados.",
      });
    }

    if (error.code === "P2025") {
      return reply.status(404).send({ error: "Registro nao encontrado." });
    }

    if (error.code === "P2002") {
      return reply.status(400).send({ error: "Ja existe um registro com estes dados." });
    }
  }

  throw error;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
