import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv, resetEnvCache } from "../../config/env.js";
import { adminAuth } from "../../middleware/adminAuth.js";
import { processQueuedJobs } from "../../services/QueueCronService.js";
import { resetOpenAIClient } from "../../services/OpenAIService.js";

const settingsSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8).optional(),
  PUBLIC_WEBHOOK_BASE_URL: z.string().optional(),
  TELEGRAM_WEBHOOK_PATH: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  USE_OPENAI_PERSONALIZATION: z.boolean().optional(),
  USE_OPENAI_CLASSIFICATION: z.boolean().optional(),
  ADMIN_API_KEY: z.string().min(8).optional(),
  MAX_MESSAGES_PER_MINUTE: z.number().positive().optional(),
  DAILY_SEND_CAP: z.number().positive().optional(),
  PER_LEAD_COOLDOWN_HOURS: z.number().positive().optional(),
  MAX_LEAD_ATTEMPTS: z.number().positive().optional(),
  FAILURE_RATE_THRESHOLD: z.number().min(0).max(1).optional(),
  CIRCUIT_WINDOW_SECONDS: z.number().positive().optional(),
  TELEGRAM_ERROR_SPIKE_THRESHOLD: z.number().positive().optional(),
  ALLOWED_CONSENT_STATUSES: z.string().optional(),
  SENDER_NAME: z.string().optional(),
  SENDER_COMPANY: z.string().optional(),
  OUTREACH_TEMPLATE: z.string().optional(),
  SALES_WEBHOOK_URL: z.string().optional(),
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
        TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET ? "********" : "",
        PUBLIC_WEBHOOK_BASE_URL: env.PUBLIC_WEBHOOK_BASE_URL,
        TELEGRAM_WEBHOOK_PATH: env.TELEGRAM_WEBHOOK_PATH,
        OPENAI_API_KEY: env.OPENAI_API_KEY ? "********" : "",
        OPENAI_MODEL: env.OPENAI_MODEL,
        USE_OPENAI_PERSONALIZATION: env.USE_OPENAI_PERSONALIZATION,
        USE_OPENAI_CLASSIFICATION: env.USE_OPENAI_CLASSIFICATION,
        MAX_MESSAGES_PER_MINUTE: env.MAX_MESSAGES_PER_MINUTE,
        DAILY_SEND_CAP: env.DAILY_SEND_CAP,
        PER_LEAD_COOLDOWN_HOURS: env.PER_LEAD_COOLDOWN_HOURS,
        MAX_LEAD_ATTEMPTS: env.MAX_LEAD_ATTEMPTS,
        FAILURE_RATE_THRESHOLD: env.FAILURE_RATE_THRESHOLD,
        CIRCUIT_WINDOW_SECONDS: env.CIRCUIT_WINDOW_SECONDS,
        TELEGRAM_ERROR_SPIKE_THRESHOLD: env.TELEGRAM_ERROR_SPIKE_THRESHOLD,
        ALLOWED_CONSENT_STATUSES: env.ALLOWED_CONSENT_STATUSES.join(","),
        SENDER_NAME: env.SENDER_NAME,
        SENDER_COMPANY: env.SENDER_COMPANY,
        OUTREACH_TEMPLATE: env.OUTREACH_TEMPLATE,
        SALES_WEBHOOK_URL: env.SALES_WEBHOOK_URL,
        hasTelegramToken: Boolean(env.TELEGRAM_BOT_TOKEN),
        hasWebhookSecret: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
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
      if (next.TELEGRAM_WEBHOOK_SECRET !== undefined) {
        process.env.TELEGRAM_WEBHOOK_SECRET = next.TELEGRAM_WEBHOOK_SECRET;
      }
      if (next.PUBLIC_WEBHOOK_BASE_URL !== undefined) {
        process.env.PUBLIC_WEBHOOK_BASE_URL = next.PUBLIC_WEBHOOK_BASE_URL;
      }
      if (next.TELEGRAM_WEBHOOK_PATH !== undefined) {
        process.env.TELEGRAM_WEBHOOK_PATH = next.TELEGRAM_WEBHOOK_PATH;
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
      if (next.MAX_MESSAGES_PER_MINUTE !== undefined) {
        process.env.MAX_MESSAGES_PER_MINUTE = String(next.MAX_MESSAGES_PER_MINUTE);
      }
      if (next.DAILY_SEND_CAP !== undefined) {
        process.env.DAILY_SEND_CAP = String(next.DAILY_SEND_CAP);
      }
      if (next.PER_LEAD_COOLDOWN_HOURS !== undefined) {
        process.env.PER_LEAD_COOLDOWN_HOURS = String(next.PER_LEAD_COOLDOWN_HOURS);
      }
      if (next.MAX_LEAD_ATTEMPTS !== undefined) {
        process.env.MAX_LEAD_ATTEMPTS = String(next.MAX_LEAD_ATTEMPTS);
      }
      if (next.FAILURE_RATE_THRESHOLD !== undefined) {
        process.env.FAILURE_RATE_THRESHOLD = String(next.FAILURE_RATE_THRESHOLD);
      }
      if (next.CIRCUIT_WINDOW_SECONDS !== undefined) {
        process.env.CIRCUIT_WINDOW_SECONDS = String(next.CIRCUIT_WINDOW_SECONDS);
      }
      if (next.TELEGRAM_ERROR_SPIKE_THRESHOLD !== undefined) {
        process.env.TELEGRAM_ERROR_SPIKE_THRESHOLD = String(
          next.TELEGRAM_ERROR_SPIKE_THRESHOLD
        );
      }
      if (next.ALLOWED_CONSENT_STATUSES !== undefined) {
        process.env.ALLOWED_CONSENT_STATUSES = next.ALLOWED_CONSENT_STATUSES;
      }
      if (next.SENDER_NAME !== undefined) {
        process.env.SENDER_NAME = next.SENDER_NAME;
      }
      if (next.SENDER_COMPANY !== undefined) {
        process.env.SENDER_COMPANY = next.SENDER_COMPANY;
      }
      if (next.OUTREACH_TEMPLATE !== undefined) {
        process.env.OUTREACH_TEMPLATE = next.OUTREACH_TEMPLATE;
      }
      if (next.SALES_WEBHOOK_URL !== undefined) {
        process.env.SALES_WEBHOOK_URL = next.SALES_WEBHOOK_URL;
      }
      resetOpenAIClient();
      resetEnvCache();
      const env = loadEnv();
      return {
        ok: true,
        PUBLIC_WEBHOOK_BASE_URL: env.PUBLIC_WEBHOOK_BASE_URL,
        TELEGRAM_WEBHOOK_PATH: env.TELEGRAM_WEBHOOK_PATH,
        OPENAI_MODEL: env.OPENAI_MODEL,
        USE_OPENAI_PERSONALIZATION: env.USE_OPENAI_PERSONALIZATION,
        USE_OPENAI_CLASSIFICATION: env.USE_OPENAI_CLASSIFICATION,
        MAX_MESSAGES_PER_MINUTE: env.MAX_MESSAGES_PER_MINUTE,
        DAILY_SEND_CAP: env.DAILY_SEND_CAP,
        PER_LEAD_COOLDOWN_HOURS: env.PER_LEAD_COOLDOWN_HOURS,
        MAX_LEAD_ATTEMPTS: env.MAX_LEAD_ATTEMPTS,
        FAILURE_RATE_THRESHOLD: env.FAILURE_RATE_THRESHOLD,
        CIRCUIT_WINDOW_SECONDS: env.CIRCUIT_WINDOW_SECONDS,
        TELEGRAM_ERROR_SPIKE_THRESHOLD: env.TELEGRAM_ERROR_SPIKE_THRESHOLD,
        ALLOWED_CONSENT_STATUSES: env.ALLOWED_CONSENT_STATUSES.join(","),
        SENDER_NAME: env.SENDER_NAME,
        SENDER_COMPANY: env.SENDER_COMPANY,
        OUTREACH_TEMPLATE: env.OUTREACH_TEMPLATE,
        SALES_WEBHOOK_URL: env.SALES_WEBHOOK_URL,
      };
    });

    admin.post("/api/v1/system/process-queues", async (req) => {
      const body = (req.body ?? {}) as { limit?: number };
      const result = await processQueuedJobs(body.limit ?? 50);
      return { ok: true, ...result };
    });
  });
}
