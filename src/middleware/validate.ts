import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

/**
 * Endpoint kirishini tekshiradi va TOZALANGAN qiymatni qaytarib qo'yadi.
 * Natijada route ichida `req.body` allaqachon ishonchli va tiplangan bo'ladi.
 */
export function validate(source: Source, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req[source] = schema.parse(req[source]);
    next();
  };
}

export const validateBody = (schema: ZodSchema) => validate("body", schema);
export const validateQuery = (schema: ZodSchema) => validate("query", schema);
export const validateParams = (schema: ZodSchema) => validate("params", schema);
