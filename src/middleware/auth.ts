import type { Request, Response, NextFunction } from "express";
import type { Role, User } from "@prisma/client";
import { verifyAccessToken, type AuthIdentity } from "../lib/auth-provider.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      /** Tokendan olingan identifikatsiya (DB'ga tegmaydi) */
      auth?: AuthIdentity;
      /** Bizning DB'dagi foydalanuvchi yozuvi */
      user?: User;
    }
  }
}

function readBearer(req: Request): string {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw unauthorized("Authorization: Bearer <token> sarlavhasi kerak");
  }
  return token;
}

/** Tokenni tekshirib req.auth'ni to'ldiradi. Bir so'rovda ikki marta tekshirmaydi. */
async function resolveAuth(req: Request): Promise<AuthIdentity> {
  req.auth ??= await verifyAccessToken(readBearer(req));
  return req.auth;
}

/**
 * DB'dagi foydalanuvchini topadi, bo'lmasa yaratadi.
 *
 * Shu sababli alohida "register" endpoint kerak emas: Firebase'da ro'yxatdan
 * o'tgan odam birinchi so'rovida bizning DB'da ham paydo bo'ladi.
 */
async function resolveUser(req: Request): Promise<User> {
  if (req.user) return req.user;
  const auth = await resolveAuth(req);

  const existing = await prisma.user.findUnique({ where: { firebaseUid: auth.uid } });
  if (existing) {
    req.user = existing;
    return existing;
  }

  const [firstName = "", ...rest] = (auth.displayName ?? "").trim().split(/\s+/);
  const created = await prisma.user.create({
    data: {
      firebaseUid: auth.uid,
      email: auth.email,
      firstName,
      lastName: rest.join(" "),
    },
  });
  req.user = created;
  return created;
}

/** Faqat tokenni tekshiradi, DB so'rovi yo'q. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  await resolveAuth(req);
  next();
}

/** Token + DB yozuvi. Savat, buyurtma kabi egasi bor resurslar uchun. */
export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  await resolveUser(req);
  next();
}

/** Tokeni bo'lsa foydalanuvchini yuklaydi, bo'lmasa ham o'tkazib yuboradi. */
export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  if (req.header("authorization")) {
    try {
      await resolveUser(req);
    } catch {
      // Yaroqsiz token = mehmon. Ommaviy endpoint'ni to'xtatmaydi.
    }
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = await resolveUser(req);
    if (!roles.includes(user.role)) {
      throw forbidden("Bu amal uchun ruxsat yetarli emas");
    }
    next();
  };
}

export const requireAdmin = requireRole("ADMIN");
