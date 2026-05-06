import type { FastifyInstance } from "fastify";
import { adminAuth } from "../../middleware/adminAuth.js";
import { prisma } from "../../db/client.js";

export async function adminLogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.get("/logs", async (req) => {
    const q = req.query as { type?: string; limit?: string };
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? 100)));
    return prisma.auditLog.findMany({
      where: q.type ? { type: q.type } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  });
}
