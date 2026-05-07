import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiKey, outreachApi, setApiKey } from "./api";

type LeadRow = {
  id: string;
  fullName: string;
  outreachStatus: string;
  consentStatus: string;
  telegramId: string | null;
  optedOut: boolean;
};

export default function App() {
  const [keyInput, setKeyInput] = useState(getApiKey());
  const [telegramTokenInput, setTelegramTokenInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  const [publicWebhookBaseUrl, setPublicWebhookBaseUrl] = useState("");
  const [webhookPath, setWebhookPath] = useState("/telegram/webhook");
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
  const [openAiModelInput, setOpenAiModelInput] = useState("gpt-4o-mini");
  const [usePersonalization, setUsePersonalization] = useState(true);
  const [useClassification, setUseClassification] = useState(true);
  const [maxPerMinute, setMaxPerMinute] = useState(10);
  const [dailyCap, setDailyCap] = useState(100);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [failureThreshold, setFailureThreshold] = useState(0.35);
  const [circuitWindowSeconds, setCircuitWindowSeconds] = useState(300);
  const [telegramSpikeThreshold, setTelegramSpikeThreshold] = useState(20);
  const [allowedConsentStatuses, setAllowedConsentStatuses] = useState(
    "GRANTED,EXPLICIT_OPT_IN"
  );
  const [senderName, setSenderName] = useState("Alex");
  const [senderCompany, setSenderCompany] = useState("Your Company");
  const [outreachTemplate, setOutreachTemplate] = useState("");
  const [salesWebhookUrl, setSalesWebhookUrl] = useState("");
  const queryClient = useQueryClient();

  const leads = useQuery({
    queryKey: ["leads"],
    queryFn: () => outreachApi.leads("?pageSize=50"),
    enabled: !!getApiKey(),
  });

  const queues = useQuery({
    queryKey: ["queues"],
    queryFn: () => outreachApi.queueStats(),
    enabled: !!getApiKey(),
    refetchInterval: 10_000,
  });

  const logs = useQuery({
    queryKey: ["logs"],
    queryFn: () => outreachApi.logs(),
    enabled: !!getApiKey(),
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => outreachApi.settings(),
    enabled: !!getApiKey(),
  });

  useEffect(() => {
    if (!settings.data) return;
    setOpenAiModelInput(settings.data.OPENAI_MODEL ?? "gpt-4o-mini");
    setUsePersonalization(settings.data.USE_OPENAI_PERSONALIZATION);
    setUseClassification(settings.data.USE_OPENAI_CLASSIFICATION);
    setPublicWebhookBaseUrl(settings.data.PUBLIC_WEBHOOK_BASE_URL ?? "");
    setWebhookPath(settings.data.TELEGRAM_WEBHOOK_PATH ?? "/telegram/webhook");
    setMaxPerMinute(settings.data.MAX_MESSAGES_PER_MINUTE ?? 10);
    setDailyCap(settings.data.DAILY_SEND_CAP ?? 100);
    setCooldownHours(settings.data.PER_LEAD_COOLDOWN_HOURS ?? 24);
    setMaxAttempts(settings.data.MAX_LEAD_ATTEMPTS ?? 2);
    setFailureThreshold(settings.data.FAILURE_RATE_THRESHOLD ?? 0.35);
    setCircuitWindowSeconds(settings.data.CIRCUIT_WINDOW_SECONDS ?? 300);
    setTelegramSpikeThreshold(settings.data.TELEGRAM_ERROR_SPIKE_THRESHOLD ?? 20);
    setAllowedConsentStatuses(
      settings.data.ALLOWED_CONSENT_STATUSES ?? "GRANTED,EXPLICIT_OPT_IN"
    );
    setSenderName(settings.data.SENDER_NAME ?? "Alex");
    setSenderCompany(settings.data.SENDER_COMPANY ?? "Your Company");
    setOutreachTemplate(settings.data.OUTREACH_TEMPLATE ?? "");
    setSalesWebhookUrl(settings.data.SALES_WEBHOOK_URL ?? "");
  }, [
    settings.data?.ALLOWED_CONSENT_STATUSES,
    settings.data?.CIRCUIT_WINDOW_SECONDS,
    settings.data?.DAILY_SEND_CAP,
    settings.data?.FAILURE_RATE_THRESHOLD,
    settings.data?.MAX_LEAD_ATTEMPTS,
    settings.data?.MAX_MESSAGES_PER_MINUTE,
    settings.data?.OPENAI_MODEL,
    settings.data?.OUTREACH_TEMPLATE,
    settings.data?.PER_LEAD_COOLDOWN_HOURS,
    settings.data?.PUBLIC_WEBHOOK_BASE_URL,
    settings.data?.SALES_WEBHOOK_URL,
    settings.data?.SENDER_COMPANY,
    settings.data?.SENDER_NAME,
    settings.data?.TELEGRAM_ERROR_SPIKE_THRESHOLD,
    settings.data?.TELEGRAM_WEBHOOK_PATH,
    settings.data?.USE_OPENAI_PERSONALIZATION,
    settings.data?.USE_OPENAI_CLASSIFICATION,
  ]);

  const upload = useMutation({
    mutationFn: (f: File) => outreachApi.upload(f),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const enqueue = useMutation({
    mutationFn: (id: string) => outreachApi.enqueue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  const pause = useMutation({
    mutationFn: () => outreachApi.pause(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queues"] }),
  });

  const resume = useMutation({
    mutationFn: () => outreachApi.resume(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queues"] }),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      outreachApi.saveSettings({
        TELEGRAM_BOT_TOKEN: telegramTokenInput || undefined,
        TELEGRAM_WEBHOOK_SECRET: webhookSecretInput || undefined,
        PUBLIC_WEBHOOK_BASE_URL: publicWebhookBaseUrl,
        TELEGRAM_WEBHOOK_PATH: webhookPath,
        OPENAI_API_KEY: openAiKeyInput || undefined,
        OPENAI_MODEL: openAiModelInput,
        USE_OPENAI_PERSONALIZATION: usePersonalization,
        USE_OPENAI_CLASSIFICATION: useClassification,
        MAX_MESSAGES_PER_MINUTE: maxPerMinute,
        DAILY_SEND_CAP: dailyCap,
        PER_LEAD_COOLDOWN_HOURS: cooldownHours,
        MAX_LEAD_ATTEMPTS: maxAttempts,
        FAILURE_RATE_THRESHOLD: failureThreshold,
        CIRCUIT_WINDOW_SECONDS: circuitWindowSeconds,
        TELEGRAM_ERROR_SPIKE_THRESHOLD: telegramSpikeThreshold,
        ALLOWED_CONSENT_STATUSES: allowedConsentStatuses,
        SENDER_NAME: senderName,
        SENDER_COMPANY: senderCompany,
        OUTREACH_TEMPLATE: outreachTemplate,
        SALES_WEBHOOK_URL: salesWebhookUrl,
      }),
    onSuccess: () => {
      setTelegramTokenInput("");
      setWebhookSecretInput("");
      setOpenAiKeyInput("");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const runQueuesNow = useMutation({
    mutationFn: () => outreachApi.processQueues(25),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.25rem" }}>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 600 }}>
        Telegram outreach admin
      </h1>

      <div className="panel">
        <label>
          Admin API key{" "}
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{
              width: "min(420px, 100%)",
              marginLeft: 8,
              padding: "6px 8px",
            }}
          />
        </label>{" "}
        <button
          type="button"
          onClick={() => {
            setApiKey(keyInput);
            void queryClient.invalidateQueries();
          }}
        >
          Save
        </button>
        <p style={{ fontSize: "0.85rem", color: "#9aa5b5", marginTop: 8 }}>
          Uses <code>X-Api-Key</code>. API base uses <code>VITE_API_BASE_URL</code>{" "}
          when set, otherwise local <code>/api</code> proxy in dev.
        </p>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Runtime settings</h2>
        {settings.data && (
          <p style={{ fontSize: "0.85rem", color: "#9aa5b5" }}>
            Telegram token: {settings.data.hasTelegramToken ? "set" : "not set"}
            {" · "}Webhook secret:{" "}
            {settings.data.hasWebhookSecret ? "set" : "not set"}
            {" · "}OpenAI key: {settings.data.hasOpenAiKey ? "set" : "not set"}
          </p>
        )}
        <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
          <label>
            Telegram bot token (leave empty to keep current)
            <input
              type="password"
              value={telegramTokenInput}
              onChange={(e) => setTelegramTokenInput(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Telegram webhook secret (leave empty to keep current)
            <input
              type="password"
              value={webhookSecretInput}
              onChange={(e) => setWebhookSecretInput(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Public webhook base URL
            <input
              type="text"
              value={publicWebhookBaseUrl}
              onChange={(e) => setPublicWebhookBaseUrl(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Telegram webhook path
            <input
              type="text"
              value={webhookPath}
              onChange={(e) => setWebhookPath(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            OpenAI API key (leave empty to keep current)
            <input
              type="password"
              value={openAiKeyInput}
              onChange={(e) => setOpenAiKeyInput(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            OpenAI model
            <input
              type="text"
              value={openAiModelInput}
              onChange={(e) => setOpenAiModelInput(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Allowed consent statuses (comma separated)
            <input
              type="text"
              value={allowedConsentStatuses}
              onChange={(e) => setAllowedConsentStatuses(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Sender name
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Sender company
            <input
              type="text"
              value={senderCompany}
              onChange={(e) => setSenderCompany(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Outreach template
            <textarea
              value={outreachTemplate}
              onChange={(e) => setOutreachTemplate(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px", minHeight: 80 }}
            />
          </label>
          <label>
            Sales webhook URL
            <input
              type="text"
              value={salesWebhookUrl}
              onChange={(e) => setSalesWebhookUrl(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Max messages per minute
            <input
              type="number"
              value={maxPerMinute}
              onChange={(e) => setMaxPerMinute(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Daily send cap
            <input
              type="number"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Per-lead cooldown hours
            <input
              type="number"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Max lead attempts
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Failure rate threshold (0 to 1)
            <input
              type="number"
              step="0.01"
              value={failureThreshold}
              onChange={(e) => setFailureThreshold(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Circuit window seconds
            <input
              type="number"
              value={circuitWindowSeconds}
              onChange={(e) => setCircuitWindowSeconds(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            Telegram error spike threshold
            <input
              type="number"
              value={telegramSpikeThreshold}
              onChange={(e) => setTelegramSpikeThreshold(Number(e.target.value))}
              style={{ width: "100%", marginTop: 6, padding: "6px 8px" }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={usePersonalization}
              onChange={(e) => setUsePersonalization(e.target.checked)}
            />{" "}
            Use OpenAI personalization
          </label>
          <label>
            <input
              type="checkbox"
              checked={useClassification}
              onChange={(e) => setUseClassification(e.target.checked)}
            />{" "}
            Use OpenAI classification
          </label>
        </div>
        <button
          type="button"
          onClick={() => saveSettings.mutate()}
          disabled={saveSettings.isPending}
          style={{ marginTop: 10 }}
        >
          {saveSettings.isPending ? "Saving..." : "Save runtime settings"}
        </button>
        {saveSettings.isError && (
          <p className="error">{(saveSettings.error as Error).message}</p>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Queues</h2>
        {queues.isLoading && <p>Loading…</p>}
        {queues.error && (
          <p className="error">{(queues.error as Error).message}</p>
        )}
        {queues.data && (
          <>
            <p>
              Outreach waiting: <strong>{queues.data.outreachWaiting}</strong>{" "}
              · Follow-up waiting:{" "}
              <strong>{queues.data.followupWaiting}</strong> · Paused:{" "}
              <strong>{queues.data.paused ? "yes" : "no"}</strong>
            </p>
            <button type="button" onClick={() => pause.mutate()}>
              Pause
            </button>{" "}
            <button type="button" onClick={() => resume.mutate()}>
              Resume
            </button>
            {" "}
            <button type="button" onClick={() => runQueuesNow.mutate()}>
              Process queued jobs now
            </button>
          </>
        )}
        {runQueuesNow.isSuccess && (
          <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
            Processed this run: outreach{" "}
            <strong>{runQueuesNow.data.outreach.processed}</strong>, follow-up{" "}
            <strong>{runQueuesNow.data.followup.processed}</strong>.
          </p>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Upload leads</h2>
        <input
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }}
        />
        {upload.isPending && <span> Uploading…</span>}
        {upload.isError && (
          <p className="error">{(upload.error as Error).message}</p>
        )}
        {upload.isSuccess && (
          <pre style={{ fontSize: "0.8rem", overflow: "auto" }}>
            {JSON.stringify(upload.data, null, 2)}
          </pre>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Leads</h2>
        {leads.isLoading && <p>Loading…</p>}
        {leads.error && (
          <p className="error">{(leads.error as Error).message}</p>
        )}
        {leads.data && (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Consent</th>
                  <th>Telegram</th>
                  <th>Opt out</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(leads.data.items as LeadRow[]).map((r) => (
                  <tr key={r.id}>
                    <td
                      style={{
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={r.id}
                    >
                      {r.id}
                    </td>
                    <td>{r.fullName}</td>
                    <td>{r.outreachStatus}</td>
                    <td>{r.consentStatus}</td>
                    <td>{r.telegramId ?? "—"}</td>
                    <td>{r.optedOut ? "yes" : "no"}</td>
                    <td>
                      <button
                        type="button"
                        disabled={
                          !r.telegramId || r.optedOut || enqueue.isPending
                        }
                        onClick={() => enqueue.mutate(r.id)}
                      >
                        Enqueue initial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Recent logs</h2>
        {logs.data && (
          <ul style={{ fontSize: "0.8rem", paddingLeft: "1.2rem" }}>
            {(logs.data as { type: string; message: string }[]).map((l, i) => (
              <li key={i}>
                <strong>{l.type}</strong>: {l.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
