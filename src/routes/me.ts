import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { notFound } from "../lib/errors.js";

export const meRouter = Router();

// Bu bo'limdagi hamma endpoint kirgan foydalanuvchini talab qiladi
meRouter.use(requireUser);

const publicUser = (u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
}) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  fullName: `${u.firstName} ${u.lastName}`.trim(),
  role: u.role,
  createdAt: u.createdAt,
});

/**
 * GET /api/me
 * Frontend login'dan keyin shuni chaqiradi: profil + account sahifasidagi sonlar.
 */
meRouter.get("/", async (req, res) => {
  const user = req.user!;

  const [orderCount, wishlistCount, addressCount, cartCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
    prisma.address.count({ where: { userId: user.id } }),
    prisma.cartItem.aggregate({ where: { userId: user.id }, _sum: { qty: true } }),
  ]);

  res.json({
    user: publicUser(user),
    emailVerified: req.auth!.emailVerified,
    stats: {
      orders: orderCount,
      wishlist: wishlistCount,
      addresses: addressCount,
      cartItems: cartCount._sum.qty ?? 0,
    },
  });
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
});

/** PATCH /api/me — ism-familiyani o'zgartirish. Email va role bu yerdan o'zgarmaydi. */
meRouter.patch("/", validateBody(updateProfileSchema), async (req, res) => {
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: req.body,
  });
  res.json({ user: publicUser(updated) });
});

// ─────────────────────────── Manzillar ───────────────────────────

const addressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  street: z.string().trim().min(1).max(200),
  apartment: z.string().trim().max(60).default(""),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zip: z.string().trim().min(3).max(20),
  country: z.string().trim().min(1).max(100).default("United States"),
  phone: z.string().trim().max(40).default(""),
  isDefault: z.boolean().default(false),
});

meRouter.get("/addresses", async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  res.json({ addresses });
});

meRouter.post("/addresses", validateBody(addressSchema), async (req, res) => {
  const userId = req.user!.id;
  const data = req.body as z.infer<typeof addressSchema>;

  // Birinchi manzil avtomatik asosiy bo'ladi
  const existingCount = await prisma.address.count({ where: { userId } });
  const isDefault = data.isDefault || existingCount === 0;

  // Bitta asosiy manzil qoidasi: yangisi asosiy bo'lsa, eskilaridan belgi olinadi.
  // Ikki yozuvni birga o'zgartirayotganimiz uchun tranzaksiya.
  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.create({ data: { ...data, isDefault, userId } });
  });

  res.status(201).json({ address });
});

meRouter.patch<{ id: string }>(
  "/addresses/:id",
  validateBody(addressSchema.partial()),
  async (req, res) => {
    const userId = req.user!.id;
    const { id } = req.params;

    // Egalik tekshiruvi: boshqa odamning manzilini o'zgartirib bo'lmaydi
    const owned = await prisma.address.findFirst({ where: { id, userId } });
    if (!owned) throw notFound("Manzil topilmadi");

    const data = req.body as Partial<z.infer<typeof addressSchema>>;

    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data });
    });

    res.json({ address });
  },
);

meRouter.delete<{ id: string }>("/addresses/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const owned = await prisma.address.findFirst({ where: { id, userId } });
  if (!owned) throw notFound("Manzil topilmadi");

  await prisma.address.delete({ where: { id } });
  res.status(204).end();
});
