/**
 * Katalogni to'ldiradi: prisma/seed-data/products.json → products + variants.
 *
 *   npm run db:seed
 *
 * Qayta ishga tushirsa bo'ladi (idempotent): upsert ishlatiladi, shuning uchun
 * mavjud mahsulot yangilanadi, dublikat yaratilmaydi. Variantlar ham o'rnidan
 * yangilanadi — zaxira (stock) qiymatlari JSON'dagiga qaytariladi.
 *
 * Ma'lumot manbasi — frontend'dagi data/products.ts dan chiqarilgan JSON.
 * Admin paneli qo'shilgandan keyin bu fayl faqat boshlang'ich holat bo'lib qoladi.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type SeedVariant = { color: string; colorHex: string; size: string; stock: number };

type SeedProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  images: string[];
  alt: string;
  badge?: string;
  description: string;
  details: string;
  consideredTogether?: string[];
  variants: SeedVariant[];
};

// Frontend'dagi lib/categories.ts bilan bir xil qoida
const ACCESSORY_CATEGORIES = ["Shoes", "Jewelry"];

// "Dresses · New season" → "Dresses"
const categoryNameOf = (category: string) => category.split("·")[0]!.trim();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const url = new URL("./seed-data/products.json", import.meta.url);
  const products = JSON.parse(await readFile(url, "utf8")) as SeedProduct[];

  if (products.length === 0) throw new Error("seed-data/products.json bo'sh");

  console.log(`${products.length} mahsulot yuklanmoqda...`);

  let variantCount = 0;

  for (const [index, p] of products.entries()) {
    const categoryName = categoryNameOf(p.category);

    const fields = {
      name: p.name,
      category: p.category,
      categoryName,
      categoryGroup: ACCESSORY_CATEGORIES.includes(categoryName) ? "Accessories" : "Clothing",
      isNew: p.badge === "New",
      price: p.price,
      rating: p.rating,
      reviews: p.reviews,
      images: p.images,
      alt: p.alt,
      badge: p.badge ?? null,
      description: p.description,
      details: p.details,
      consideredTogether: p.consideredTogether ?? [],
      isActive: true,
      // JSON'dagi tartib "featured" tartibi bo'lib qoladi
      sortOrder: index,
    };

    await prisma.product.upsert({
      where: { id: p.id },
      create: { id: p.id, ...fields },
      update: fields,
    });

    // Variantlar: rang+o'lcham juftligi bo'yicha upsert.
    // Butunlay o'chirib qayta yaratmaymiz — cart_items ularga ishora qiladi.
    for (const v of p.variants) {
      await prisma.variant.upsert({
        where: {
          productId_color_size: { productId: p.id, color: v.color, size: v.size },
        },
        create: { productId: p.id, ...v },
        update: { colorHex: v.colorHex, stock: v.stock },
      });
      variantCount += 1;
    }
  }

  // JSON'dan olib tashlangan variantlar DB'da qolib ketmasligi kerak
  const removed = await prisma.variant.deleteMany({
    where: {
      NOT: products.flatMap((p) =>
        p.variants.map((v) => ({ productId: p.id, color: v.color, size: v.size })),
      ),
    },
  });

  const [productTotal, variantTotal] = await Promise.all([
    prisma.product.count(),
    prisma.variant.count(),
  ]);

  console.log(`✓ ${productTotal} mahsulot, ${variantTotal} variant (${variantCount} yozildi)`);
  if (removed.count > 0) console.log(`✓ ${removed.count} eskirgan variant o'chirildi`);
}

main()
  .catch((err) => {
    console.error("Seed muvaffaqiyatsiz:", err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
