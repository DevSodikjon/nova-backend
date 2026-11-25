import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../lib/prisma.js";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { isProd } from "../env.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `${req.method} ${req.path} — bunday endpoint yo'q`, "NOT_FOUND"));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // 1) Zod — kirish ma'lumoti noto'g'ri
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Yuborilgan ma'lumot noto'g'ri",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  // 2) Bizning kutilgan xatolarimiz
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // 3) Prisma'ning ma'lum kodlari
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: { code: "CONFLICT", message: "Bu yozuv allaqachon mavjud" } });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Yozuv topilmadi" } });
    }
  }

  // 4) Kutilmagan xato: batafsiloti log'ga, mijozga umumiy xabar
  logger.error({ err, path: req.path, method: req.method }, "Kutilmagan xato");
  return res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Serverda xatolik yuz berdi",
      ...(isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
