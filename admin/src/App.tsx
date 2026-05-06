import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
          Uses <code>X-Api-Key</code>. Dev server proxies <code>/api</code> →
          backend :3002.
        </p>
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
          </>
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
