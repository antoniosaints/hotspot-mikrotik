import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

const DEFAULT_LOCAL_ID = "local-padrao";
const DEFAULT_MIKROTIK_ID = "mikrotik-exemplo";

async function seedAdmin() {
  const adminCount = await prisma.admin.count();
  if (adminCount > 0) {
    console.log("Seed: admin ja existe, mantido como esta.");
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production" && !adminPassword) {
    throw new Error("ADMIN_PASSWORD deve ser definido para criar o admin inicial em producao.");
  }

  const senhaHash = await bcrypt.hash(adminPassword ?? "admin123", 10);
  await prisma.admin.create({
    data: {
      usuario: "admin",
      senhaHash,
      role: "admin",
      ativo: true,
    },
  });
  console.log("Seed: admin inicial criado.");
}

// Dados de exemplo sao criados apenas na PRIMEIRA execucao (banco vazio).
// Se ja existe qualquer local/mikrotik/hotspot — mesmo com nomes ou slugs
// alterados depois — o seed nao recria nada.
async function seedExampleData() {
  const [locais, mikrotiks, hotspots] = await Promise.all([
    prisma.local.count(),
    prisma.mikrotik.count(),
    prisma.hotspot.count(),
  ]);

  if (locais > 0 || mikrotiks > 0 || hotspots > 0) {
    console.log("Seed: dados ja existentes, exemplos nao serao recriados.");
    return;
  }

  const local = await prisma.local.create({
    data: {
      id: DEFAULT_LOCAL_ID,
      nome: "Local Padrao",
      descricao: "Local padrao para o hotspot",
      ativo: true,
    },
  });

  const mikrotik = await prisma.mikrotik.create({
    data: {
      id: DEFAULT_MIKROTIK_ID,
      nome: "MikroTik Exemplo",
      host: "192.168.88.1",
      usuarioApi: "api",
      senhaApi: "trocar-esta-senha",
      portaApi: 8728,
      timeoutApi: 5000,
      profilePadrao: "default",
      ativo: false,
    },
  });

  await prisma.hotspot.create({
    data: {
      nome: "Hotspot Padrao",
      slug: "padrao",
      portalUrl: "http://localhost:5173/portal/padrao",
      urlPosLogin: null,
      loginVoucher: true,
      loginCpf: true,
      ativo: true,
      localId: local.id,
      mikrotikId: mikrotik.id,
    },
  });

  console.log("Seed: dados de exemplo criados (local, mikrotik e hotspot padrao).");
}

async function main() {
  await seedAdmin();
  await seedExampleData();
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
