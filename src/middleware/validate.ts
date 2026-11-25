import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";

/**
 * So'rov tanasini (body) tekshiradi va TOZALANGAN qiymatni o'rniga qo'yadi.
 * Zod noma'lum maydonlarni tashlab yuboradi, shuning uchun route ichida
 * `req.body` faqat kutilgan maydonlardan iborat bo'ladi — masalan `role`
 * yuborilsa, DB'ga yetib bormaydi.
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

/**
 * Query va params uchun middleware YO'Q — ataylab.
 *
 * Express 5'da `req.query` faqat o'quvchi getter: unga yozishga urinish
 * `TypeError: Cannot set property query` beradi. Shuning uchun tekshirilgan
 * qiymat qaytarib beriladi va route uni o'zgaruvchiga oladi — bu yo'l
 * tiplarni ham saqlab qoladi.
 */
export const parseQuery = <T>(req: Request, schema: z.ZodType<T>): T =>
  schema.parse(req.query);

export const parseParams = <T>(req: Request, schema: z.ZodType<T>): T =>
  schema.parse(req.params);
