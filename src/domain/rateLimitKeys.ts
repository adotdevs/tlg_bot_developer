/** Redis key helpers */
export const REDIS_KEYS = {
  dailySendCount: (day: string) => `outreach:daily_sends:${day}`,
  systemPaused: "outreach:system_paused",
  circuitSent: (windowStart: number) => `outreach:circuit:sent:${windowStart}`,
  circuitFailed: (windowStart: number) => `outreach:circuit:failed:${windowStart}`,
  tgErrorsWindow: (windowStart: number) => `outreach:tg_errors:${windowStart}`,
} as const;

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

export function circuitWindowStart(nowMs: number, windowSec: number): number {
  const w = windowSec * 1000;
  return Math.floor(nowMs / w) * w;
}
