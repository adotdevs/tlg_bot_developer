const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API = rawBase && rawBase.length > 0 ? rawBase.replace(/\/+$/, "") : "/api/v1";

export function getApiKey(): string {
  return localStorage.getItem("outreach_api_key") ?? "";
}

export function setApiKey(k: string): void {
  localStorage.setItem("outreach_api_key", k);
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const key = getApiKey();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": key,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export const outreachApi = {
  leads: (q?: string) =>
    api<{ items: unknown[]; total: number }>(`/leads${q ?? ""}`),
  queueStats: () =>
    api<{
      outreachWaiting: number;
      followupWaiting: number;
      paused: boolean;
    }>("/queues/stats"),
  pause: () => api<{ ok: boolean }>("/queues/pause", { method: "POST" }),
  resume: () => api<{ ok: boolean }>("/queues/resume", { method: "POST" }),
  logs: () => api<unknown[]>("/logs?limit=50"),
  upload: async (file: File) => {
    const key = getApiKey();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API}/leads/upload`, {
      method: "POST",
      headers: { "X-Api-Key": key },
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  enqueue: (id: string) =>
    api<{ jobId: string }>(`/leads/${id}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "initial" }),
    }),
  settings: () =>
    api<{
      TELEGRAM_BOT_TOKEN: string;
      TELEGRAM_WEBHOOK_SECRET: string;
      PUBLIC_WEBHOOK_BASE_URL: string;
      TELEGRAM_WEBHOOK_PATH: string;
      OPENAI_API_KEY: string;
      OPENAI_MODEL: string;
      USE_OPENAI_PERSONALIZATION: boolean;
      USE_OPENAI_CLASSIFICATION: boolean;
      MAX_MESSAGES_PER_MINUTE: number;
      DAILY_SEND_CAP: number;
      PER_LEAD_COOLDOWN_HOURS: number;
      MAX_LEAD_ATTEMPTS: number;
      FAILURE_RATE_THRESHOLD: number;
      CIRCUIT_WINDOW_SECONDS: number;
      TELEGRAM_ERROR_SPIKE_THRESHOLD: number;
      ALLOWED_CONSENT_STATUSES: string;
      SENDER_NAME: string;
      SENDER_COMPANY: string;
      OUTREACH_TEMPLATE: string;
      SALES_WEBHOOK_URL: string;
      hasTelegramToken: boolean;
      hasWebhookSecret: boolean;
      hasOpenAiKey: boolean;
    }>("/system/settings"),
  saveSettings: (payload: {
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    PUBLIC_WEBHOOK_BASE_URL?: string;
    TELEGRAM_WEBHOOK_PATH?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    USE_OPENAI_PERSONALIZATION?: boolean;
    USE_OPENAI_CLASSIFICATION?: boolean;
    ADMIN_API_KEY?: string;
    MAX_MESSAGES_PER_MINUTE?: number;
    DAILY_SEND_CAP?: number;
    PER_LEAD_COOLDOWN_HOURS?: number;
    MAX_LEAD_ATTEMPTS?: number;
    FAILURE_RATE_THRESHOLD?: number;
    CIRCUIT_WINDOW_SECONDS?: number;
    TELEGRAM_ERROR_SPIKE_THRESHOLD?: number;
    ALLOWED_CONSENT_STATUSES?: string;
    SENDER_NAME?: string;
    SENDER_COMPANY?: string;
    OUTREACH_TEMPLATE?: string;
    SALES_WEBHOOK_URL?: string;
  }) =>
    api<{ ok: boolean }>("/system/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  processQueues: (limit = 50) =>
    api<{
      ok: boolean;
      outreach: { processed: number; failed: number };
      followup: { processed: number; failed: number };
    }>("/system/process-queues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit }),
    }),
};
