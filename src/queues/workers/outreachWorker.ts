import { Worker } from "bullmq";
import { loadEnv } from "../../config/env.js";
import { getRedisConnection } from "../connection.js";
import { OUTREACH_QUEUE } from "../jobs.js";
import type { OutreachJobPayload } from "../jobs.js";
import { processOutreachSend } from "../../services/OutboundProcessor.js";
import { createTelegramServiceFromEnv } from "../../services/TelegramService.js";

export function createOutreachWorker(): Worker {
  const env = loadEnv();
  const telegram = createTelegramServiceFromEnv();
  const connection = getRedisConnection();

  return new Worker(
    OUTREACH_QUEUE,
    async (job) => {
      const payload = job.data as OutreachJobPayload;
      await processOutreachSend(connection, telegram, payload);
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: env.MAX_MESSAGES_PER_MINUTE,
        duration: 60_000,
      },
    }
  );
}
