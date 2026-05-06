import type { FastifyInstance } from "fastify";
import { adminAuth } from "../../middleware/adminAuth.js";
import { getQueueStats } from "../../services/QueueService.js";
import { getRedisConnection } from "../../queues/connection.js";
import { setSystemPaused, isSystemPaused } from "../../services/CircuitBreakerService.js";

export async function adminQueueRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", adminAuth);

  app.get("/queues/stats", async () => {
    const stats = await getQueueStats();
    const redis = getRedisConnection();
    const paused = await isSystemPaused(redis);
    return { ...stats, paused };
  });

  app.post("/queues/pause", async () => {
    const redis = getRedisConnection();
    await setSystemPaused(redis, true, "manual_pause");
    return { ok: true, paused: true };
  });

  app.post("/queues/resume", async () => {
    const redis = getRedisConnection();
    await setSystemPaused(redis, false, "manual_resume");
    return { ok: true, paused: false };
  });
}
