import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 dan boshlab migration va introspection sozlamalari shu faylda turadi.
// Runtime ulanish esa src/lib/prisma.ts dagi adapter orqali.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
