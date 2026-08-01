// Prisma Seed — Dados iniciais
// Rode com: npx tsx prisma/seed.ts

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL || "file:./data/kairos.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed...");

  // Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "igreja-central" },
    update: {},
    create: {
      name: "Igreja Central Kairos",
      slug: "igreja-central",
    },
  });
  console.log("✅ Tenant criado:", tenant.name);

  // Admin user
  const hash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kairos.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Administrador",
      email: "admin@kairos.com",
      passwordHash: hash,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin criado:", admin.email);
  console.log("   Senha: admin123");

  // Congregations
  try {
    const cong = await prisma.congregation.createMany({
      data: [
        { tenantId: tenant.id, name: "Sede Central", address: "Rua Principal, 100" },
        { tenantId: tenant.id, name: "Filial Norte", address: "Av. Norte, 200" },
      ],
    });
    console.log(`✅ ${cong.count} congregações criadas`);
  } catch { console.log("⚠️ Congregações já existem"); }

  // Members de exemplo
  try {
    const membros = await prisma.member.createMany({
      data: [
        { tenantId: tenant.id, name: "João Silva", email: "joao@email.com", phone: "11999990001" },
        { tenantId: tenant.id, name: "Maria Souza", email: "maria@email.com", phone: "11999990002", baptized: true },
        { tenantId: tenant.id, name: "Pedro Santos", email: "pedro@email.com", phone: "11999990003" },
      ],
    });
    console.log(`✅ ${membros.count} membros criados`);
  } catch { console.log("⚠️ Membros já existem"); }

  console.log("🎉 Seed concluído!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());