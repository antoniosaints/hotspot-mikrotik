// Migra a bilheteria para o novo modelo Plano (N:N com Hotspot) sem perder
// os vinculos existentes, e aplica o restante do schema (servidorHotspot).
//
// Uso (na pasta apps/api):
//   node scripts/migrate-planos.mjs
//
// O que ele faz:
// 1. Le o mapeamento plano -> hotspot da coluna antiga PlanoBilheteria.hotspotId
//    (se ainda existir) e salva um backup em scripts/planos-backup.json.
// 2. Roda `prisma db push --accept-data-loss --skip-generate` (remove a coluna
//    antiga e cria a tabela de juncao _HotspotToPlano).
// 3. Reinsere os vinculos na tabela _HotspotToPlano.
// 4. Roda `prisma generate` para atualizar o client.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = join(scriptDir, "..");

// Usa o mesmo .env que o prisma CLI vai usar no db push.
loadEnv({ path: join(apiDir, ".env") });
process.env.DATABASE_URL ??= "file:../data/hotspot.sqlite";

const { PrismaClient } = await import("@prisma/client");

async function readLegacyLinks() {
  const prisma = new PrismaClient();
  try {
    const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info("PlanoBilheteria")`);
    const hasLegacyColumn = columns.some((column) => column.name === "hotspotId");
    if (!hasLegacyColumn) {
      console.log("Coluna hotspotId nao existe mais; nada para migrar.");
      return [];
    }

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id AS planoId, hotspotId FROM "PlanoBilheteria" WHERE hotspotId IS NOT NULL`,
    );
    return rows;
  } finally {
    await prisma.$disconnect();
  }
}

async function insertLinks(links) {
  if (links.length === 0) return;
  const prisma = new PrismaClient();
  try {
    for (const link of links) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "_HotspotToPlano" ("A", "B") VALUES (?, ?)`,
        link.hotspotId,
        link.planoId,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

const links = await readLegacyLinks();
if (links.length > 0) {
  const backupPath = join(scriptDir, "planos-backup.json");
  writeFileSync(backupPath, JSON.stringify(links, null, 2));
  console.log(`Backup de ${links.length} vinculo(s) salvo em ${backupPath}`);
}

console.log("Aplicando schema (prisma db push)...");
execSync("pnpm exec prisma db push --accept-data-loss --skip-generate", {
  cwd: apiDir,
  stdio: "inherit",
});

await insertLinks(links);
console.log(`Vinculos restaurados: ${links.length}`);

console.log("Gerando Prisma Client...");
execSync("pnpm exec prisma generate", { cwd: apiDir, stdio: "inherit" });

console.log("Migracao concluida.");
