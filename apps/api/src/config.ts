const DEFAULT_DATABASE_URL = "file:../data/hotspot.sqlite";
const DEV_JWT_SECRET = "dev-hotspot-secret";

function readNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: readNumber(process.env.PORT, 3333),
  jwtSecret: readJwtSecret(),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  // URL publica da API (ex.: https://apihotspot.cas.net.br), usada para montar
  // a notification_url do Mercado Pago. Atras de proxy/Cloudflare, o hostname
  // da request nao e confiavel para isso.
  publicApiUrl: readPublicApiUrl(),
} as const;

function readPublicApiUrl() {
  const value = process.env.PUBLIC_API_URL?.trim();
  return value ? value.replace(/\/+$/, "") : undefined;
}

export type AppConfig = typeof config;

function readJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEV_JWT_SECRET || secret.length < 32) {
      throw new Error("JWT_SECRET forte e obrigatorio em producao.");
    }
  }

  return secret ?? DEV_JWT_SECRET;
}
