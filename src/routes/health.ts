import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

// Yengil tekshiruv: process tirikmi (load balancer uchun)
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

// Chuqur tekshiruv: DB ham javob beradimi
healthRouter.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", database: "unreachable" });
  }
});
