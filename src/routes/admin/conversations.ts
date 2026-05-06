import type { FastifyInstance } from "fastify";
import { adminAuth } from "../../middleware/adminAuth.js";
import { prisma } from "../../db/client.js";

export async function adminConversationRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.get("/conversations", async (req) => {
    const q = req.query as { leadId?: string };
    const where = q.leadId ? { leadId: q.leadId } : {};
    return prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { lead: true },
    });
  });

  app.get("/conversations/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) {
      await reply.code(404).send({ error: "not found" });
      return;
    }
    const messages = await prisma.message.findMany({
      where: { leadId: conv.leadId },
      orderBy: { createdAt: "asc" },
    });
    return { conversation: conv, messages };
  });
}
