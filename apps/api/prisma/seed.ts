import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";

const DEFAULT_LOCAL_ID = "local-padrao";
const DEFAULT_MIKROTIK_ID = "mikrotik-exemplo";

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production" && !adminPassword) {
    throw new Error("ADMIN_PASSWORD deve ser definido para executar o seed em producao.");
  }

  const senhaHash = await bcrypt.hash(adminPassword ?? "admin123", 10);

  await prisma.admin.upsert({
    where: { usuario: "admin" },
    update: {},
    create: {
      usuario: "admin",
      senhaHash,
      role: "admin",
      ativo: true,
    },
  });

  const local = await prisma.local.upsert({
    where: { id: DEFAULT_LOCAL_ID },
    update: {},
    create: {
      id: DEFAULT_LOCAL_ID,
      nome: "Local Padrao",
      descricao: "Local padrao para o hotspot",
      ativo: true,
    },
  });

  const mikrotik = await prisma.mikrotik.upsert({
    where: { id: DEFAULT_MIKROTIK_ID },
    update: {},
    create: {
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

  await prisma.hotspot.upsert({
    where: { slug: "padrao" },
    update: {
      localId: local.id,
      mikrotikId: mikrotik.id,
    },
    create: {
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
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
