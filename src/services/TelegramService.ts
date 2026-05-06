import { Bot, GrammyError, HttpError } from "grammy";
import { loadEnv } from "../config/env.js";

export type SendResult =
  | { ok: true; telegramMessageId: string }
  | { ok: false; error: string; isTelegramError: boolean };

export class TelegramService {
  private bot: Bot | null = null;

  constructor(private readonly token: string) {
    if (token) this.bot = new Bot(token);
  }

  getBot(): Bot | null {
    return this.bot;
  }

  async sendMessage(chatId: string, text: string): Promise<SendResult> {
    if (!this.bot) {
      return {
        ok: false,
        error: "Telegram bot token not configured",
        isTelegramError: false,
      };
    }
    try {
      const m = await this.bot.api.sendMessage(chatId, text);
      return { ok: true, telegramMessageId: String(m.message_id) };
    } catch (e) {
      const isTg = e instanceof GrammyError || e instanceof HttpError;
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
      return { ok: false, error: msg, isTelegramError: isTg };
    }
  }
}

export function createTelegramServiceFromEnv(): TelegramService {
  const env = loadEnv();
  return new TelegramService(env.TELEGRAM_BOT_TOKEN ?? "");
}
