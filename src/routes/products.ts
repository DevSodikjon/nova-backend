import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { parseParams, parseQuery } from "../middleware/validate.js";
import { notFound } from "../lib/errors.js";
import { serializeProduct, variantOrder } from "../lib/catalog.js";

export const productsRouter = Router();

/** Shop sahifasidagi bir betdagi mahsulot soni (frontend PER_PAGE bilan bir xil) */
const DEFAULT_PER_PAGE = 9;
const MAX_PER_PAGE = 48;

/**
 * Bo'sh satrni "berilmagan" deb hisoblaydi.
 * Frontend `?q=` ni filtrsiz deb qaraydi (lib/shop.ts), server ham shunday
 * qarashi kerak — aks holda bo'sh maydonli forma 422 oladi.
 */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(1).max(max).optional(),
  );

const optionalNumber = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().nonnegative().max(max).optional(),
  );

const listQuery = z.object({
  q: optionalText(100),
  category: optionalText(60),
  size: optionalText(20),
  color: optionalText(40),
  min: optionalNumber(1_000_000),
  max: optionalNumber(1_000_000),
  sort: z.enum(["featured", "new", "price-asc", "price-desc"]).default("featured"),
  page: z.coerce.number().int().positive().max(10_000).default(1),
  limit: z.coerce.number().int().positive().max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

type ListQuery = z.infer<typeof listQuery>;

function buildWhere(f: ListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { category: { contains: f.q, mode: "insensitive" } },
    ];
  }

  if (f.category) where.categoryName = { equals: f.category, mode: "insensitive" };

  if (f.min !== undefined || f.max !== undefined) {
    where.price = {
      ...(f.min !== undefined ? { gte: f.min } : {}),
      ...(f.max !== undefined ? { lte: f.max } : {}),
    };
  }

  // O'lcham va rang zaxirasi BOR variantlar bo'yicha tekshiriladi:
  // sotuvda yo'q o'lchamni filtrda ko'rsatishning ma'nosi yo'q.
  const variantFilters: Prisma.VariantWhereInput[] = [];
  if (f.size) variantFilters.push({ size: { equals: f.size, mode: "insensitive" }, stock: { gt: 0 } });
  if (f.color) variantFilters.push({ color: { equals: f.color, mode: "insensitive" }, stock: { gt: 0 } });

  // Ikki shart bo'lsa, ikkisi bir variantda uchrashi SHART EMAS —
  // "M o'lchamda bor" va "Navy rangda bor" alohida tekshiriladi.
  if (variantFilters.length === 1) where.variants = { some: variantFilters[0]! };
  else if (variantFilters.length > 1) where.AND = variantFilters.map((v) => ({ variants: { some: v } }));

  return where;
}

function buildOrderBy(sort: ListQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { sortOrder: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { sortOrder: "asc" }];
    case "new":
      return [{ isNew: "desc" }, { sortOrder: "asc" }];
    default:
      // featured: seed'dagi tartib
      return [{ sortOrder: "asc" }];
  }
}

/**
 * GET /api/products
 *
 * Filtrlar: q, category, size, color, min, max
 * Tartib:   featured | new | price-asc | price-desc
 * Betlash:  page, limit (standart 9, maksimum 48)
 */
productsRouter.get("/products", async (req, res) => {
  const f = parseQuery(req, listQuery);

  const where = buildWhere(f);

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(f.sort),
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: { variants: { orderBy: variantOrder } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / f.limit));

  res.json({
    products: rows.map(serializeProduct),
    pagination: {
      page: f.page,
      limit: f.limit,
      total,
      totalPages,
      hasNext: f.page < totalPages,
      hasPrev: f.page > 1,
    },
  });
});

const idParam = z.object({ id: z.string().trim().min(1).max(120) });

/**
 * GET /api/products/:id
 * Mahsulot + "bu bilan birga ko'rilgan" ro'yxati (bitta so'rovda).
 */
productsRouter.get("/products/:id", async (req, res) => {
  const { id } = parseParams(req, idParam);

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: { variants: { orderBy: variantOrder } },
  });

  if (!product) throw notFound("Mahsulot topilmadi");

  // Havola qilingan mahsulot o'chirilgan bo'lsa, javobdan tushib qoladi
  const related = product.consideredTogether.length
    ? await prisma.product.findMany({
        where: { id: { in: product.consideredTogether }, isActive: true },
        include: { variants: { orderBy: variantOrder } },
      })
    : [];

  // consideredTogether dagi tartibni saqlaymiz — DB tartibi boshqacha keladi
  const byId = new Map(related.map((p) => [p.id, p]));
  const ordered = product.consideredTogether
    .map((rid) => byId.get(rid))
    .filter((p): p is (typeof related)[number] => p !== undefined);

  res.json({
    product: serializeProduct(product),
    related: ordered.map(serializeProduct),
  });
});
