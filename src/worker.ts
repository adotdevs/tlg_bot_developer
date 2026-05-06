import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { createOutreachWorker } from "./queues/workers/outreachWorker.js";
import { createFollowupWorker } from "./queues/workers/followupWorker.js";

loadEnv();

const w1 = createOutreachWorker();
const w2 = createFollowupWorker();

for (const ev of ["SIGINT", "SIGTERM"] as const) {
  process.on(ev, async () => {
    await w1.close();
    await w2.close();
    process.exit(0);
  });
}

console.log("Workers started: outreach_queue, followup_queue");
