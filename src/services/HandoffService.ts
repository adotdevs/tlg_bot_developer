import type { Prisma } from "@prisma/client";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import { auditLog } from "./AuditLogService.js";

export async function handoffToSales(
  leadId: string,
  summary?: string
): Promise<void> {
  const env = loadEnv();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        outreachStatus: "HANDOFF",
        assignedTo: "sales_queue",
      },
    });
    const conv = await tx.conversation.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    if (conv) {
      await tx.conversation.update({
        where: { id: conv.id },
        data: {
          status: "HANDOFF",
          summary: summary ?? conv.summary,
        },
      });
    } else {
      await tx.conversation.create({
        data: {
          leadId,
          status: "HANDOFF",
          summary: summary ?? null,
        },
      });
    }
  });

  await auditLog("handoff", `Lead ${leadId} marked HANDOFF`, { leadId });

  if (env.SALES_WEBHOOK_URL) {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      await fetch(env.SALES_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead_interested",
          leadId,
          fullName: lead?.fullName,
          telegramId: lead?.telegramId,
          summary: summary ?? null,
        }),
      });
    } catch (e) {
      await auditLog(
        "handoff_webhook_failed",
        e instanceof Error ? e.message : "webhook error",
        { leadId }
      );
    }
  }
}
