import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { checkAuthProviderReachable } from "./lib/auth-provider.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Nova backend tayyor → http://localhost:${env.PORT}`);
});

// Kalitlar manbasini bir marta tekshiramiz. Serverni to'xtatmaydi (Google vaqtincha
// javob bermasligi deploy'ni buzmasligi kerak), lekin log'da baland ovozda aytadi.
void checkAuthProviderReachable()
  .then(() => logger.info("Auth provayderi kalitlari o'qildi (JWKS)"))
  .catch((err) =>
    logger.error(
      { err },
      "JWKS o'qilmadi — HAMMA token 401 bo'ladi. FIREBASE_PROJECT_ID va JWKS manzilini tekshiring.",
    ),
  );

// Deploy paytida yangi versiya chiqqanda ochiq so'rovlarni uzmaslik uchun
async function shutdown(signal: string) {
  logger.info(`${signal} keldi, to'xtatilmoqda...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("To'xtadi");
    process.exit(0);
  });
  // 10 soniyada yopilmasa majburan chiqadi
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
