import type { Job } from "bullmq";
import { loadEnv } from "../config/env.js";
import { getRedisConnection } from "../queues/connection.js";
import { getFollowupQueue } from "../queues/followup.queue.js";
import type { OutreachJobPayload } from "../queues/jobs.js";
import { getOutreachQueue } from "../queues/outreach.queue.js";
import { processOutreachSend } from "./OutboundProcessor.js";
import { createTelegramServiceFromEnv } from "./TelegramService.js";

async function runJobs(jobs: Job[]): Promise<{ processed: number; failed: number }> {
  const redis = getRedisConnection();
  const telegram = createTelegramServiceFromEnv();
  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const payload = job.data as OutreachJobPayload;
      await processOutreachSend(redis, telegram, payload);
      await job.remove();
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed, failed };
}

export async function processQueuedJobs(
  limit = 50
): Promise<{
  outreach: { processed: number; failed: number };
  followup: { processed: number; failed: number };
  maxPerRun: number;
  maxMessagesPerMinute: number;
}> {
  const env = loadEnv();
  const bounded = Math.max(1, Math.min(limit, env.MAX_MESSAGES_PER_MINUTE));
  const outreachJobs = await getOutreachQueue().getJobs(
    ["waiting"],
    0,
    bounded - 1
  );
  const followupJobs = await getFollowupQueue().getJobs(
    ["waiting"],
    0,
    bounded - 1
  );

  const outreach = await runJobs(outreachJobs);
  const followup = await runJobs(followupJobs);

  return {
    outreach,
    followup,
    maxPerRun: bounded,
    maxMessagesPerMinute: env.MAX_MESSAGES_PER_MINUTE,
  };
}
