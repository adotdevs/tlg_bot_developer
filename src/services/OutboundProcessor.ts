import type { Redis } from "ioredis";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import {
  canEnqueueFollowup,
  canExecuteInitialOutreachSend,
} from "../domain/outreachRules.js";
import {
  REDIS_KEYS,
  secondsUntilUtcMidnight,
  utcDayKey,
} from "../domain/rateLimitKeys.js";
import { applyTemplate } from "../domain/templates.js";
import { auditLog } from "./AuditLogService.js";
import { recordSendResult, isSystemPaused } from "./CircuitBreakerService.js";
import { personalizeTemplate, suggestFollowUp } from "./OpenAIService.js";
import type { TelegramService } from "./TelegramService.js";
import type { OutreachJobPayload } from "../queues/jobs.js";

export async function processOutreachSend(
  redis: Redis,
  telegram: TelegramService,
  payload: OutreachJobPayload
): Promise<void> {
  const env = loadEnv();
  if (await isSystemPaused(redis)) {
    await auditLog("send_skipped", "system_paused", {
      leadId: payload.leadId,
      kind: payload.kind,
    });
    return;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: payload.leadId },
  });
  if (!lead) {
    await auditLog("send_skipped", "lead_not_found", payload);
    return;
  }

  const elig =
    payload.kind === "followup"
      ? canEnqueueFollowup(lead, { systemPaused: false })
      : canExecuteInitialOutreachSend(lead, env, { systemPaused: false });
  if (!elig.ok) {
    await auditLog("send_skipped", elig.reason, {
      leadId: lead.id,
      kind: payload.kind,
    });
    return;
  }

  const day = utcDayKey();
  const dkey = REDIS_KEYS.dailySendCount(day);
  const current = Number((await redis.get(dkey)) ?? 0);
  if (current >= env.DAILY_SEND_CAP) {
    await auditLog("send_skipped", "daily_cap_reached", {
      leadId: lead.id,
      day,
    });
    return;
  }

  let text: string;
  if (payload.kind === "followup") {
    const lastInbound = await prisma.message.findFirst({
      where: { leadId: lead.id, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
    });
    text = await suggestFollowUp({
      leadName: lead.fullName,
      inboundQuestion: lastInbound?.content ?? "",
    });
  } else {
    const base = applyTemplate(env.OUTREACH_TEMPLATE, {
      name: lead.fullName,
      sender_name: env.SENDER_NAME,
      company: env.SENDER_COMPANY,
    });
    text = await personalizeTemplate({
      name: lead.fullName,
      sender_name: env.SENDER_NAME,
      company: env.SENDER_COMPANY,
      baseText: base,
    });
  }

  const pending = await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: "OUTBOUND",
      content: text,
      status: "PENDING",
    },
  });

  const chatId = lead.telegramId!;
  const result = await telegram.sendMessage(chatId, text);

  if (result.ok) {
    await redis.incr(dkey);
    if (current === 0) {
      await redis.expire(dkey, secondsUntilUtcMidnight());
    }

    await prisma.$transaction([
      prisma.message.update({
        where: { id: pending.id },
        data: { status: "SENT", telegramMessageId: result.telegramMessageId },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          attemptCount: { increment: 1 },
          lastContactedAt: new Date(),
          outreachStatus:
            payload.kind === "followup" ? "FOLLOWUP_SENT" : "AWAITING_REPLY",
          ...(payload.kind === "followup" ? { followupUsed: true } : {}),
        },
      }),
    ]);
    await recordSendResult(redis, true, false);
    await auditLog("message_sent", "outbound", {
      leadId: lead.id,
      messageId: pending.id,
      kind: payload.kind,
    });
  } else {
    await prisma.message.update({
      where: { id: pending.id },
      data: { status: "FAILED" },
    });
    await recordSendResult(redis, false, result.isTelegramError);
    await auditLog("message_failed", result.error, {
      leadId: lead.id,
      messageId: pending.id,
      kind: payload.kind,
    });
  }
}
