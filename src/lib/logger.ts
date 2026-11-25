import pino from "pino";
import { env, isProd } from "../env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isProd ? "info" : "debug",
  // Development'da o'qishga qulay chiqish; production'da JSON (log tizimlari uchun)
  transport: isProd
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
