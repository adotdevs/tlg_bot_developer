const API = "/api/v1";

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
};
