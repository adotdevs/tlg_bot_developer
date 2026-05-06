import type { Redis } from "ioredis";
import { loadEnv } from "../config/env.js";
import {
  REDIS_KEYS,
  circuitWindowStart,
} from "../domain/rateLimitKeys.js";
import { auditLog } from "./AuditLogService.js";

export async function isSystemPaused(redis: Redis): Promise<boolean> {
  const v = await redis.get(REDIS_KEYS.systemPaused);
  return v === "1" || v === "true";
}

export async function setSystemPaused(
  redis: Redis,
  paused: boolean,
  reason: string
): Promise<void> {
  if (paused) {
    await redis.set(REDIS_KEYS.systemPaused, "1");
    await auditLog("system_pause", reason, { paused: true });
  } else {
    await redis.del(REDIS_KEYS.systemPaused);
    await auditLog("system_resume", reason, { paused: false });
  }
}

export async function recordSendResult(
  redis: Redis,
  success: boolean,
  isTelegramError: boolean
): Promise<void> {
  const env = loadEnv();
  const w = circuitWindowStart(Date.now(), env.CIRCUIT_WINDOW_SECONDS);
  if (success) {
    await redis.incr(REDIS_KEYS.circuitSent(w));
    await redis.expire(REDIS_KEYS.circuitSent(w), env.CIRCUIT_WINDOW_SECONDS * 2);
  } else {
    await redis.incr(REDIS_KEYS.circuitFailed(w));
    await redis.expire(
      REDIS_KEYS.circuitFailed(w),
      env.CIRCUIT_WINDOW_SECONDS * 2
    );
    if (isTelegramError) {
      await redis.incr(REDIS_KEYS.tgErrorsWindow(w));
      await redis.expire(
        REDIS_KEYS.tgErrorsWindow(w),
        env.CIRCUIT_WINDOW_SECONDS * 2
      );
    }
  }

  const sent = Number(await redis.get(REDIS_KEYS.circuitSent(w)) ?? 0);
  const failed = Number(await redis.get(REDIS_KEYS.circuitFailed(w)) ?? 0);
  const total = sent + failed;
  if (total >= 10) {
    const rate = failed / total;
    if (rate >= env.FAILURE_RATE_THRESHOLD) {
      await setSystemPaused(
        redis,
        true,
        `Circuit breaker: failure rate ${rate.toFixed(2)} in window ${w}`
      );
    }
  }

  const tgErr = Number(await redis.get(REDIS_KEYS.tgErrorsWindow(w)) ?? 0);
  if (tgErr >= env.TELEGRAM_ERROR_SPIKE_THRESHOLD) {
    await setSystemPaused(
      redis,
      true,
      `Telegram error spike: ${tgErr} in window ${w}`
    );
  }
}
