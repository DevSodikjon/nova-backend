import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7: migration va introspection sozlamalari.
 * Runtime ulanish esa src/lib/prisma.ts dagi driver adapter orqali.
 *
 * Nega DIRECT_URL alohida:
 * Neon (va boshqa serverless Postgres'lar) ikki manzil beradi — pooler orqali
 * va to'g'ridan-to'g'ri. Ilova pooler'dan foydalanadi (ulanishlarni tejaydi),
 * lekin migration'lar pooler ustida ishlamaydi: ular tranzaksiya ichida
 * DDL bajaradi va seansga bog'liq holatni talab qiladi.
 *
 * Lokal Postgres'da DIRECT_URL kerak emas — DATABASE_URL ishlatiladi.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
