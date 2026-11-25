import "dotenv/config";
import { z } from "zod";

// Server ishga tushishida bir marta tekshiriladi: noto'g'ri sozlama bilan
// yarim ishlaydigan holatda turgandan ko'ra, darhol to'xtash yaxshiroq.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL kerak"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID kerak"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Muhit sozlamalari noto'g'ri:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
