import { describe, expect, it } from "vitest";
import { getOutreachQueue } from "../../src/queues/outreach.queue";
import { getFollowupQueue } from "../../src/queues/followup.queue";

const run = process.env.INTEGRATION === "1";

describe.skipIf(!run)("integration: redis queue connection", () => {
  it("creates queue clients", async () => {
    const o = getOutreachQueue();
    const f = getFollowupQueue();
    expect(o.name).toBe("outreach_queue");
    expect(f.name).toBe("followup_queue");
    await o.close();
    await f.close();
  });
});
