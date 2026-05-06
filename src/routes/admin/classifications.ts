import type { FastifyInstance } from "fastify";
import { adminAuth } from "../../middleware/adminAuth.js";
import { prisma } from "../../db/client.js";
import type { ClassificationLabel } from "@prisma/client";

export async function adminClassificationRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.get("/classifications", async (req) => {
    const q = req.query as {
      messageId?: string;
      leadId?: string;
      label?: ClassificationLabel;
    };
    if (q.messageId) {
      return prisma.classification.findMany({
        where: { messageId: q.messageId },
        include: { message: true },
      });
    }
    if (q.leadId) {
      const msgs = await prisma.message.findMany({
        where: { leadId: q.leadId },
        select: { id: true },
      });
      const ids = msgs.map((m: { id: string }) => m.id);
      return prisma.classification.findMany({
        where: { messageId: { in: ids } },
        include: { message: true },
      });
    }
    const where = q.label ? { label: q.label } : {};
    return prisma.classification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { message: true },
    });
  });
}
