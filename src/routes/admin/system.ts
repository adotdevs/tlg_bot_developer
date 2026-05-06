import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv, resetEnvCache } from "../../config/env.js";
import { adminAuth } from "../../middleware/adminAuth.js";
import { processQueuedJobs } from "../../services/QueueCronService.js";
import { resetOpenAIClient } from "../../services/OpenAIService.js";

const settingsSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  USE_OPENAI_PERSONALIZATION: z.boolean().optional(),
  USE_OPENAI_CLASSIFICATION: z.boolean().optional(),
  ADMIN_API_KEY: z.string().min(8).optional(),
});

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cron/process-queues", async (req, reply) => {
    const q = req.query as { apiKey?: string; limit?: string };
    const env = loadEnv();
    if (!q.apiKey || q.apiKey !== env.ADMIN_API_KEY) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const limit = Number(q.limit ?? 50);
    const result = await processQueuedJobs(limit);
    return { ok: true, ...result };
  });

  app.register(async (admin) => {
    admin.addHook("preHandler", adminAuth);

    admin.get("/api/v1/system/settings", async () => {
      const env = loadEnv();
      return {
        TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN ? "********" : "",
        OPENAI_API_KEY: env.OPENAI_API_KEY ? "********" : "",
        OPENAI_MODEL: env.OPENAI_MODEL,
        USE_OPENAI_PERSONALIZATION: env.USE_OPENAI_PERSONALIZATION,
        USE_OPENAI_CLASSIFICATION: env.USE_OPENAI_CLASSIFICATION,
        hasTelegramToken: Boolean(env.TELEGRAM_BOT_TOKEN),
        hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
      };
    });

    admin.post("/api/v1/system/settings", async (req, reply) => {
      const parsed = settingsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        await reply.code(400).send({ error: parsed.error.flatten() });
        return;
      }
      const next = parsed.data;
      if (next.TELEGRAM_BOT_TOKEN !== undefined) {
        process.env.TELEGRAM_BOT_TOKEN = next.TELEGRAM_BOT_TOKEN;
      }
      if (next.OPENAI_API_KEY !== undefined) {
        process.env.OPENAI_API_KEY = next.OPENAI_API_KEY;
      }
      if (next.OPENAI_MODEL !== undefined) {
        process.env.OPENAI_MODEL = next.OPENAI_MODEL;
      }
      if (next.USE_OPENAI_PERSONALIZATION !== undefined) {
        process.env.USE_OPENAI_PERSONALIZATION = next.USE_OPENAI_PERSONALIZATION
          ? "true"
          : "false";
      }
      if (next.USE_OPENAI_CLASSIFICATION !== undefined) {
        process.env.USE_OPENAI_CLASSIFICATION = next.USE_OPENAI_CLASSIFICATION
          ? "true"
          : "false";
      }
      if (next.ADMIN_API_KEY !== undefined) {
        process.env.ADMIN_API_KEY = next.ADMIN_API_KEY;
      }
      resetOpenAIClient();
      resetEnvCache();
      const env = loadEnv();
      return {
        ok: true,
        OPENAI_MODEL: env.OPENAI_MODEL,
        USE_OPENAI_PERSONALIZATION: env.USE_OPENAI_PERSONALIZATION,
        USE_OPENAI_CLASSIFICATION: env.USE_OPENAI_CLASSIFICATION,
      };
    });

    admin.post("/api/v1/system/process-queues", async (req) => {
      const body = (req.body ?? {}) as { limit?: number };
      const result = await processQueuedJobs(body.limit ?? 50);
      return { ok: true, ...result };
    });
  });
}
