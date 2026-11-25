import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { forbidden } from "./lib/errors.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { productsRouter } from "./routes/products.js";
import { catalogRouter } from "./routes/catalog.js";

export function createApp() {
  const app = express();

  // Netlify/Render kabi proxy ortida ishlaganda haqiqiy IP ni o'qish uchun.
  // Rate limiting shu IP ga tayanadi, shuning uchun muhim.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // Origin yo'q = server-to-server yoki curl. Brauzer so'rovlari har doim yuboradi.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        // AppError bo'lgani uchun 403 qaytadi. Oddiy Error bo'lsa "kutilmagan xato"
        // sifatida 500 bo'lib, log'ni keraksiz stack trace bilan to'ldiradi.
        callback(forbidden(`CORS: ${origin} ruxsat etilmagan`));
      },
      credentials: true,
      maxAge: 86_400,
    }),
  );

  // Katta JSON bilan xotirani to'ldirishning oldini oladi
  app.use(express.json({ limit: "100kb" }));

  app.use(pinoHttp({ logger }));

  // Umumiy cheklov: bir IP dan 15 daqiqada 300 so'rov
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: env.NODE_ENV === "production" ? 300 : 10_000,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: { code: "RATE_LIMITED", message: "Juda ko'p so'rov. Keyinroq urinib ko'ring." } },
    }),
  );

  app.use(healthRouter);
  // Katalog ommaviy: token talab qilmaydi
  app.use("/api", productsRouter);
  app.use("/api", catalogRouter);
  app.use("/api/me", meRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
