import type { Prisma } from "@prisma/client";
import { toNumber } from "./prisma.js";

/** Shu sondan kam qolgan mahsulot "Low stock" deb ko'rsatiladi. */
export const LOW_STOCK_THRESHOLD = 30;

export type VariantRow = {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
};

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  categoryGroup: string;
  isNew: boolean;
  price: Prisma.Decimal;
  rating: Prisma.Decimal;
  reviews: number;
  images: string[];
  alt: string;
  badge: string | null;
  description: string;
  details: string;
  consideredTogether: string[];
  variants: VariantRow[];
};

/**
 * DB yozuvini API javobiga aylantiradi.
 *
 * Ikki ish qiladi: Decimal'ni raqamga o'tkazadi (JSON Decimal'ni bilmaydi) va
 * zaxira holatini SERVERDA hisoblaydi. Oldin bu hisob frontend'da edi
 * (lib/stock.ts) — demak chegarani brauzerda o'zgartirib bo'lardi.
 */
export function serializeProduct(p: ProductRow) {
  const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);

  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryName: p.categoryName,
    categoryGroup: p.categoryGroup,
    isNew: p.isNew,
    price: toNumber(p.price),
    rating: toNumber(p.rating),
    reviews: p.reviews,
    images: p.images,
    alt: p.alt,
    badge: p.badge,
    description: p.description,
    details: p.details,
    consideredTogether: p.consideredTogether,
    variants: p.variants.map((v) => ({
      id: v.id,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      stock: v.stock,
    })),
    totalStock,
    stockStatus: totalStock <= LOW_STOCK_THRESHOLD ? "Low stock" : "In stock",
    inStock: totalStock > 0,
  };
}

export type SerializedProduct = ReturnType<typeof serializeProduct>;

/** Variantlar har doim bir xil tartibda qaytsin — rang, keyin o'lcham. */
export const variantOrder = [{ color: "asc" }, { size: "asc" }] satisfies Prisma.VariantOrderByWithRelationInput[];
