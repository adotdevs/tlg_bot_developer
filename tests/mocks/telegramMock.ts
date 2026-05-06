import type { SendResult } from "../../src/services/TelegramService.js";

/** Test double: record calls without hitting Telegram Bot API */
export function createTelegramMock(): {
  sendMessage: (chatId: string, text: string) => Promise<SendResult>;
  calls: { chatId: string; text: string }[];
} {
  const calls: { chatId: string; text: string }[] = [];
  return {
    calls,
    async sendMessage(chatId: string, text: string): Promise<SendResult> {
      calls.push({ chatId, text });
      return { ok: true, telegramMessageId: String(calls.length) };
    },
  };
}
