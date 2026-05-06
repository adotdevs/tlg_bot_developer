import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { loadEnv } from "../config/env.js";
import { prisma } from "../db/client.js";
import {
  canEnqueueFollowup,
  canEnqueueOutreach,
} from "../domain/outreachRules.js";
import { isSystemPaused } from "./CircuitBreakerService.js";
import { auditLog } from "./AuditLogService.js";
import { getFollowupQueue } from "../queues/followup.queue.js";
import { getOutreachQueue } from "../queues/outreach.queue.js";
import type { OutreachJobPayload } from "../queues/jobs.js";

export async function enqueueOutreachJob(
  redis: Redis,
  leadId: string,
  kind: "initial" | "followup"
): Promise<{ ok: true; jobId: string } | { ok: false; reason: string }> {
  const env = loadEnv();
  if (await isSystemPaused(redis)) {
    return { ok: false, reason: "system_paused" };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, reason: "lead_not_found" };

  const gated =
    kind === "followup"
      ? canEnqueueFollowup(lead, { systemPaused: false })
      : canEnqueueOutreach(lead, env, { systemPaused: false });

  if (!gated.ok) {
    return { ok: false, reason: gated.reason };
  }

  const payload: OutreachJobPayload = {
    leadId,
    kind,
    idempotencyKey: randomUUID(),
  };

  if (kind === "followup") {
    await getFollowupQueue().add("send_followup", payload, {
      jobId: `${leadId}:followup:${payload.idempotencyKey}`,
    });
  } else {
    await getOutreachQueue().add("send_outreach", payload, {
      jobId: `${leadId}:initial:${payload.idempotencyKey}`,
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { outreachStatus: "QUEUED" },
    });
  }

  await auditLog("job_enqueued", `${kind} for ${leadId}`, { leadId, kind });
  return { ok: true, jobId: payload.idempotencyKey };
}

export async function getQueueStats(): Promise<{
  outreachWaiting: number;
  followupWaiting: number;
}> {
  const o = await getOutreachQueue().getWaitingCount();
  const f = await getFollowupQueue().getWaitingCount();
  return { outreachWaiting: o, followupWaiting: f };
}
