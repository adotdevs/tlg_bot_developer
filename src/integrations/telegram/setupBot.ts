import { Bot } from "grammy";
import { getRedisConnection } from "../../queues/connection.js";
import { handleInboundText } from "../../services/ReplyService.js";

export function attachMessageHandlers(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    const uid = String(ctx.from?.id ?? "");
    if (!uid) return;
    const redis = getRedisConnection();
    await handleInboundText(redis, uid, ctx.message.text);
  });
}
