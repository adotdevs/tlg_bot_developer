import type { ConsentStatus } from "@prisma/client";
import type { Env } from "../config/env.js";

export function hasAllowedConsent(
  status: ConsentStatus,
  allowed: Env["ALLOWED_CONSENT_STATUSES"]
): boolean {
  return allowed.includes(status);
}
