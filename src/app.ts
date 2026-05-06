import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { loadEnv } from "./config/env.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { adminLeadRoutes } from "./routes/admin/leads.js";
import { adminQueueRoutes } from "./routes/admin/queues.js";
import { adminConversationRoutes } from "./routes/admin/conversations.js";
import { adminClassificationRoutes } from "./routes/admin/classifications.js";
import { adminLogRoutes } from "./routes/admin/logs.js";
import { adminExportRoutes } from "./routes/admin/export.js";
import { telegramWebhookRoutes } from "./routes/telegram/webhook.js";

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  loadEnv();
  const app = Fastify({ logger: true });
  registerErrorHandler(app);

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  await healthRoutes(app);
  await telegramWebhookRoutes(app);

  await app.register(adminLeadRoutes, { prefix: "/api/v1" });
  await app.register(adminQueueRoutes, { prefix: "/api/v1" });
  await app.register(adminConversationRoutes, { prefix: "/api/v1" });
  await app.register(adminClassificationRoutes, { prefix: "/api/v1" });
  await app.register(adminLogRoutes, { prefix: "/api/v1" });
  await app.register(adminExportRoutes, { prefix: "/api/v1" });

  return app;
}
