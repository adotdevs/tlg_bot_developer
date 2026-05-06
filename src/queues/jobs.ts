export const OUTREACH_QUEUE = "outreach_queue";
export const FOLLOWUP_QUEUE = "followup_queue";

export type OutreachJobPayload = {
  leadId: string;
  kind: "initial" | "followup";
  idempotencyKey: string;
};
