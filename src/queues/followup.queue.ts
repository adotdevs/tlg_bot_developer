import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { FOLLOWUP_QUEUE } from "./jobs.js";

let queue: Queue | null = null;

export function getFollowupQueue(): Queue {
  if (!queue) {
    queue = new Queue(FOLLOWUP_QUEUE, {
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
