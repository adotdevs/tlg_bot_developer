import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { OUTREACH_QUEUE } from "./jobs.js";

let queue: Queue | null = null;

export function getOutreachQueue(): Queue {
  if (!queue) {
    queue = new Queue(OUTREACH_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queue;
}
