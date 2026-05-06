import type { Redis } from "ioredis";
import { prisma } from "../db/client.js";
import { nextActionForClassification } from "../domain/outreachRules.js";
import { summarizeConversation } from "./OpenAIService.js";
import { classifyInbound } from "./ClassificationService.js";
import { handoffToSales } from "./HandoffService.js";
import { auditLog } from "./AuditLogService.js";
import { enqueueOutreachJob } from "./QueueService.js";

export async function handleInboundText(
  redis: Redis,
  telegramUserId: string,
  text: string
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { telegramId: telegramUserId },
  });

  if (!lead) {
    await auditLog("inbound_unknown", "No lead for telegram id", {
      telegramUserId,
    });
    return;
  }

  if (lead.outreachStatus === "HANDOFF" || lead.optedOut) {
    await prisma.message.create({
      data: {
        leadId: lead.id,
        direction: "INBOUND",
        content: text,
        status: "SENT",
      },
    });
    await auditLog("inbound_after_handoff", "stored only", {
      leadId: lead.id,
    });
    return;
  }

  const msgRow = await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: "INBOUND",
      content: text,
      status: "SENT",
    },
  });

  const recentOut = await prisma.message.findFirst({
    where: { leadId: lead.id, direction: "OUTBOUND" },
    orderBy: { createdAt: "desc" },
  });

  const { label, confidence, raw } = await classifyInbound(
    text,
    recentOut?.content
  );

  await prisma.classification.create({
    data: {
      messageId: msgRow.id,
      label,
      confidence,
      rawModelOutput: JSON.parse(JSON.stringify(raw)),
    },
  });

  await auditLog("classification", label, {
    leadId: lead.id,
    messageId: msgRow.id,
    confidence,
  });

  const action = nextActionForClassification(label, lead.followupUsed);

  const thread = await prisma.message.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const summary = await summarizeConversation(
    thread.map((m) => ({
      direction: m.direction,
      content: m.content,
    }))
  );

  switch (action.kind) {
    case "handoff": {
      await handoffToSales(lead.id, summary);
      break;
    }
    case "stop": {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { optedOut: true, outreachStatus: "CLOSED" },
      });
      await auditLog("opt_out", "Lead opted out via STOP", { leadId: lead.id });
      break;
    }
    case "mark_not_interested": {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { outreachStatus: "NOT_INTERESTED" },
      });
      break;
    }
    case "mark_later": {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { outreachStatus: "CLOSED" },
      });
      break;
    }
    case "enqueue_followup": {
      const enq = await enqueueOutreachJob(redis, lead.id, "followup");
      if (!enq.ok) {
        await auditLog("followup_enqueue_failed", enq.reason, {
          leadId: lead.id,
        });
      }
      break;
    }
    case "unknown_no_automation":
    default:
      await auditLog("classification_unknown", "no automation", {
        leadId: lead.id,
      });
      break;
  }

  const conv = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });
  if (conv) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { summary },
    });
  } else {
    await prisma.conversation.create({
      data: { leadId: lead.id, summary, status: "OPEN" },
    });
  }
}
