import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../env.js";

// Prisma 7 driver adapter orqali ulanadi: ulanish manzili kodda, schema faylida emas.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export { Prisma };

// Decimal qiymatlarni JSON javobiga chiqarishdan oldin raqamga aylantiradi.
// Pul hisob-kitobi DB va server tomonida Decimal bo'lib qoladi — bu faqat javob uchun.
export const toNumber = (value: Prisma.Decimal | number | null | undefined): number =>
  value == null ? 0 : typeof value === "number" ? value : value.toNumber();
