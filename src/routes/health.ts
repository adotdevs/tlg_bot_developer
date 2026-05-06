import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { getRedisConnection } from "../queues/connection.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/health/ready", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const r = getRedisConnection();
      await r.ping();
      return { ok: true, postgres: true, redis: true };
    } catch (e) {
      return reply.code(503).send({ ok: false, error: String(e) });
    }
  });
}
