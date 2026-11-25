import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { toNumber } from "../lib/prisma.js";

export const catalogRouter = Router();

/**
 * GET /api/categories
 *
 * Kategoriyalar, har birida mahsulot soni va muqova rasmi.
 * Frontend'dagi lib/categories.ts shu javobga almashadi — u yerda hamma
 * mahsulotni o'qib JS'da guruhlanardi, bu esa katalog o'sganda sekinlashadi.
 */
catalogRouter.get("/categories", async (_req, res) => {
  const [groups, covers, total] = await Promise.all([
    prisma.product.groupBy({
      by: ["categoryName", "categoryGroup"],
      where: { isActive: true },
      _count: { _all: true },
      _min: { sortOrder: true },
    }),
    // Har kategoriyadan birinchi mahsulot — muqova rasmi uchun
    prisma.product.findMany({
      where: { isActive: true },
      distinct: ["categoryName"],
      orderBy: { sortOrder: "asc" },
      select: { categoryName: true, images: true },
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  const coverOf = new Map(covers.map((c) => [c.categoryName, c.images[0] ?? ""]));

  const categories = groups
    .map((g) => ({
      name: g.categoryName,
      group: g.categoryGroup,
      count: g._count._all,
      cover: coverOf.get(g.categoryName) ?? "",
      sortOrder: g._min.sortOrder ?? 0,
    }))
    // Katalogdagi tartibni saqlaydi (groupBy tartibni kafolatlamaydi)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);

  res.json({ categories, total });
});

/**
 * GET /api/filters
 *
 * Shop sahifasidagi yon panel uchun: haqiqatan mavjud o'lchamlar, ranglar va
 * narx oralig'i. Frontend'dagi data/filters.ts da bu qiymatlar qo'lda yozilgan
 * va haqiqatga mos emas edi (masalan "All clothing: 126", aslida 11 mahsulot).
 */
catalogRouter.get("/filters", async (_req, res) => {
  const [variants, priceRange] = await Promise.all([
    prisma.variant.findMany({
      where: { product: { isActive: true } },
      select: { size: true, color: true, colorHex: true, stock: true },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  // Zaxirasi bor variantlar — tanlanganda natija bo'sh chiqmasligi uchun
  const available = variants.filter((v) => v.stock > 0);

  const sizes = [...new Set(available.map((v) => v.size))].sort((a, b) => {
    // Kiyim o'lchamlari mantiqiy tartibda, raqamlilar (poyabzal) sonli tartibda
    const order = ["XS", "S", "M", "L", "XL", "One size"];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return Number(a) - Number(b) || a.localeCompare(b);
  });

  const colorMap = new Map<string, string>();
  for (const v of available) if (!colorMap.has(v.color)) colorMap.set(v.color, v.colorHex);

  res.json({
    sizes,
    colors: [...colorMap.entries()]
      .map(([name, hex]) => ({ name, hex }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    price: {
      min: toNumber(priceRange._min.price),
      max: toNumber(priceRange._max.price),
    },
  });
});
