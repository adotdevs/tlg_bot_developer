import type { FastifyInstance } from "fastify";
import type { Update } from "grammy/types";
import { loadEnv } from "../../config/env.js";
import { createTelegramServiceFromEnv } from "../../services/TelegramService.js";
import { attachMessageHandlers } from "../../integrations/telegram/setupBot.js";

export async function telegramWebhookRoutes(
  app: FastifyInstance
): Promise<void> {
  const env = loadEnv();
  const tg = createTelegramServiceFromEnv();
  const bot = tg.getBot();
  if (!bot) return;

  attachMessageHandlers(bot);

  const path =
    env.TELEGRAM_WEBHOOK_PATH.startsWith("/")
      ? env.TELEGRAM_WEBHOOK_PATH
      : `/${env.TELEGRAM_WEBHOOK_PATH}`;

  app.post<{
    Body: Update;
  }>(path, async (req, reply) => {
    const secret = req.headers["x-telegram-bot-api-secret-token"];
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      await reply.code(401).send({ ok: false });
      return;
    }
    await bot.handleUpdate(req.body);
    await reply.send({ ok: true });
  });
}
