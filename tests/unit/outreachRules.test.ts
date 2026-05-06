import { describe, expect, it } from "vitest";
import {
  canEnqueueFollowup,
  canEnqueueOutreach,
  canExecuteInitialOutreachSend,
  nextActionForClassification,
} from "../../src/domain/outreachRules";
import { ConsentStatus, OutreachStatus } from "@prisma/client";

import type { Env } from "../../src/config/env";

const baseEnv = {
  ALLOWED_CONSENT_STATUSES: ["GRANTED", "EXPLICIT_OPT_IN"],
  MAX_LEAD_ATTEMPTS: 2,
  PER_LEAD_COOLDOWN_HOURS: 24,
} as unknown as Env;

function lead(
  overrides: Partial<{
    optedOut: boolean;
    consentStatus: ConsentStatus;
    telegramId: string | null;
    attemptCount: number;
    lastContactedAt: Date | null;
    outreachStatus: OutreachStatus;
    followupUsed: boolean;
  }> = {}
) {
  return {
    optedOut: false,
    consentStatus: "GRANTED" as ConsentStatus,
    telegramId: "123",
    attemptCount: 0,
    lastContactedAt: null,
    outreachStatus: "PENDING" as OutreachStatus,
    followupUsed: false,
    ...overrides,
  };
}

describe("canEnqueueOutreach", () => {
  it("rejects without consent", () => {
    const r = canEnqueueOutreach(
      lead({ consentStatus: "NONE" }),
      baseEnv,
      {}
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_consent");
  });

  it("rejects opted out", () => {
    const r = canEnqueueOutreach(
      lead({ optedOut: true }),
      baseEnv,
      {}
    );
    expect(r.reason).toBe("opted_out");
  });

  it("rejects without telegram id", () => {
    const r = canEnqueueOutreach(
      lead({ telegramId: null }),
      baseEnv,
      {}
    );
    expect(r.reason).toBe("no_telegram");
  });

  it("allows valid pending lead", () => {
    const r = canEnqueueOutreach(lead({}), baseEnv, {});
    expect(r.ok).toBe(true);
  });

  it("rejects queued (already enqueued)", () => {
    const r = canEnqueueOutreach(
      lead({ outreachStatus: "QUEUED" }),
      baseEnv,
      {}
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_status");
  });
});

describe("canExecuteInitialOutreachSend", () => {
  it("allows queued lead for worker send", () => {
    const r = canExecuteInitialOutreachSend(
      lead({ outreachStatus: "QUEUED" }),
      baseEnv,
      {}
    );
    expect(r.ok).toBe(true);
  });

  it("rejects sent lead", () => {
    const r = canExecuteInitialOutreachSend(
      lead({ outreachStatus: "SENT" }),
      baseEnv,
      {}
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_status");
  });
});

describe("nextActionForClassification", () => {
  it("handoff for interested", () => {
    expect(nextActionForClassification("INTERESTED", false).kind).toBe(
      "handoff"
    );
  });
  it("single followup for needs info", () => {
    expect(nextActionForClassification("NEEDS_INFO", false).kind).toBe(
      "enqueue_followup"
    );
    expect(nextActionForClassification("NEEDS_INFO", true).kind).toBe("stop");
  });
});

describe("canEnqueueFollowup", () => {
  it("allows when awaiting reply and followup not used", () => {
    expect(
      canEnqueueFollowup(
        {
          optedOut: false,
          telegramId: "1",
          followupUsed: false,
          outreachStatus: "AWAITING_REPLY",
        },
        {}
      ).ok
    ).toBe(true);
  });
});
