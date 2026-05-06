import type {
  ClassificationLabel,
  Lead,
  OutreachStatus,
} from "@prisma/client";
import { hasAllowedConsent } from "./consent.js";
import type { Env } from "../config/env.js";

export type SendEligibilityReason =
  | "ok"
  | "opted_out"
  | "no_consent"
  | "no_telegram"
  | "max_attempts"
  | "cooldown"
  | "system_paused"
  | "invalid_status";

export function canEnqueueOutreach(
  lead: Pick<
    Lead,
    | "optedOut"
    | "consentStatus"
    | "telegramId"
    | "attemptCount"
    | "lastContactedAt"
    | "outreachStatus"
  >,
  env: Env,
  opts: { now?: Date; systemPaused?: boolean }
): { ok: boolean; reason: SendEligibilityReason } {
  const now = opts.now ?? new Date();
  if (opts.systemPaused) return { ok: false, reason: "system_paused" };
  if (lead.optedOut) return { ok: false, reason: "opted_out" };
  if (!hasAllowedConsent(lead.consentStatus, env.ALLOWED_CONSENT_STATUSES)) {
    return { ok: false, reason: "no_consent" };
  }
  if (!lead.telegramId?.trim()) return { ok: false, reason: "no_telegram" };
  if (lead.attemptCount >= env.MAX_LEAD_ATTEMPTS) {
    return { ok: false, reason: "max_attempts" };
  }
  if (lead.lastContactedAt) {
    const ms = env.PER_LEAD_COOLDOWN_HOURS * 3600 * 1000;
    if (now.getTime() - lead.lastContactedAt.getTime() < ms) {
      return { ok: false, reason: "cooldown" };
    }
  }
  const blocked: OutreachStatus[] = [
    "HANDOFF",
    "NOT_INTERESTED",
    "CLOSED",
    "QUEUED",
    "AWAITING_REPLY",
    "FOLLOWUP_SENT",
    "SENT",
  ];
  if (blocked.includes(lead.outreachStatus)) {
    return { ok: false, reason: "invalid_status" };
  }
  return { ok: true, reason: "ok" };
}

/** Eligibility when the worker runs an initial job (lead was set to QUEUED on enqueue). */
export function canExecuteInitialOutreachSend(
  lead: Pick<
    Lead,
    | "optedOut"
    | "consentStatus"
    | "telegramId"
    | "attemptCount"
    | "lastContactedAt"
    | "outreachStatus"
  >,
  env: Env,
  opts: { now?: Date; systemPaused?: boolean }
): { ok: boolean; reason: SendEligibilityReason } {
  const now = opts.now ?? new Date();
  if (opts.systemPaused) return { ok: false, reason: "system_paused" };
  if (lead.optedOut) return { ok: false, reason: "opted_out" };
  if (!hasAllowedConsent(lead.consentStatus, env.ALLOWED_CONSENT_STATUSES)) {
    return { ok: false, reason: "no_consent" };
  }
  if (!lead.telegramId?.trim()) return { ok: false, reason: "no_telegram" };
  if (lead.attemptCount >= env.MAX_LEAD_ATTEMPTS) {
    return { ok: false, reason: "max_attempts" };
  }
  if (lead.lastContactedAt) {
    const ms = env.PER_LEAD_COOLDOWN_HOURS * 3600 * 1000;
    if (now.getTime() - lead.lastContactedAt.getTime() < ms) {
      return { ok: false, reason: "cooldown" };
    }
  }
  const allowed: OutreachStatus[] = [
    "IMPORTED",
    "UNMATCHED",
    "PENDING",
    "QUEUED",
  ];
  if (!allowed.includes(lead.outreachStatus)) {
    return { ok: false, reason: "invalid_status" };
  }
  return { ok: true, reason: "ok" };
}

export function canEnqueueFollowup(
  lead: Pick<
    Lead,
    | "optedOut"
    | "telegramId"
    | "followupUsed"
    | "outreachStatus"
  >,
  opts: { systemPaused?: boolean }
): { ok: boolean; reason: string } {
  if (opts.systemPaused) return { ok: false, reason: "system_paused" };
  if (lead.optedOut) return { ok: false, reason: "opted_out" };
  if (!lead.telegramId?.trim()) return { ok: false, reason: "no_telegram" };
  if (lead.followupUsed) return { ok: false, reason: "followup_used" };
  if (
    lead.outreachStatus !== "AWAITING_REPLY" &&
    lead.outreachStatus !== "FOLLOWUP_SENT"
  ) {
    return { ok: false, reason: "invalid_status" };
  }
  return { ok: true, reason: "ok" };
}

export type NextReplyAction =
  | { kind: "handoff" }
  | { kind: "enqueue_followup" }
  | { kind: "stop" }
  | { kind: "mark_not_interested" }
  | { kind: "mark_later" }
  | { kind: "unknown_no_automation" };

export function nextActionForClassification(
  label: ClassificationLabel,
  followupAlreadyUsed: boolean
): NextReplyAction {
  switch (label) {
    case "INTERESTED":
      return { kind: "handoff" };
    case "STOP":
      return { kind: "stop" };
    case "NOT_INTERESTED":
      return { kind: "mark_not_interested" };
    case "LATER":
      return { kind: "mark_later" };
    case "NEEDS_INFO":
      return followupAlreadyUsed
        ? { kind: "stop" }
        : { kind: "enqueue_followup" };
    case "UNKNOWN":
    default:
      return { kind: "unknown_no_automation" };
  }
}
