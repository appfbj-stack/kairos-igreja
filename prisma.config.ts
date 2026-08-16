import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    directory: "./prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://kairos_igreja_user:tMDDYehRWOkhaojneP662TI6KIoSvoCQ@kairos-shared-pg:5432/kairos_igreja_db",
  },
});
