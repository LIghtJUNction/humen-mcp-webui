import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Github, Image, ListChecks, LogOut, MessageSquareText, RefreshCw, Send } from "lucide-react";
import "./styles.css";

type TaskKind = "choice" | "text" | "image_review" | "steps";

type HumanRequest = {
  id: string;
  kind: TaskKind;
  title: string;
  prompt: string;
  choices: string[];
  image_url?: string | null;
  steps: string[];
  created_at: number;
  timeout_seconds: number;
};

type User = {
  email: string;
  provider: "password" | "github";
};

type AuthConfig = {
  github_enabled: boolean;
};

const tokenKey = "humen-mcp-token";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiPath(path: string) {
  return `${base}${path}`;
}

function wsPath(token: string) {
  const url = new URL(apiPath(`/api/ws?token=${encodeURIComponent(token)}`), window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<HumanRequest[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId]
  );

  useEffect(() => {
    const fromOAuth = new URLSearchParams(window.location.search).get("token");
    if (fromOAuth) {
      localStorage.setItem(tokenKey, fromOAuth);
      setToken(fromOAuth);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(apiPath("/api/me"), { headers: authHeaders(token) })
      .then((response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => logout(setToken, setUser, setRequests));
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    refresh(token, setRequests, setBusy);
    const ws = new WebSocket(wsPath(token));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setRequests(message.requests);
        setOnlineCount(message.online_count ?? 0);
      }
      if (message.type === "request_created") {
        setRequests((current) => upsertRequest(current, message.request));
      }
      if (message.type === "request_answered") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
      }
      if (message.type === "presence_changed") {
        setOnlineCount(message.online_count);
      }
    };
    return () => ws.close();
  }, [token, user]);

  if (!token || !user) {
    return <Login onToken={setToken} />;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>humen-mcp</h1>
            <p>{user.email}</p>
          </div>
          <button className="iconButton" title="Log out" onClick={() => logout(setToken, setUser, setRequests)}>
            <LogOut size={18} />
          </button>
        </div>

        <div className="toolbar">
          <span>{requests.length} pending</span>
          <span className="online">{onlineCount} online</span>
          <button className="iconButton" title="Refresh" onClick={() => refresh(token, setRequests, setBusy)}>
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </div>

        <div className="requestList">
          {requests.map((request) => (
            <button
              key={request.id}
              className={`requestItem ${selected?.id === request.id ? "active" : ""}`}
              onClick={() => setSelectedId(request.id)}
            >
              <TaskIcon kind={request.kind} />
              <span>
                <strong>{request.title}</strong>
                <small>{request.kind.replace("_", " ")}</small>
              </span>
            </button>
          ))}
          {requests.length === 0 && <div className="empty">No pending requests</div>}
        </div>
      </aside>

      <section className="workspace">
        {selected ? (
          <TaskPanel request={selected} token={token} afterSubmit={() => setSelectedId(null)} />
        ) : (
          <div className="blank">
            <MessageSquareText size={32} />
            <span>Waiting for agent requests</span>
          </div>
        )}
      </section>
    </main>
  );
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ github_enabled: false });

  useEffect(() => {
    fetch(apiPath("/api/auth/config"))
      .then((response) => response.json())
      .then((config) => setAuthConfig(config))
      .catch(() => setAuthConfig({ github_enabled: false }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(apiPath("/api/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, pass })
    });
    if (!response.ok) {
      setError("Admin login failed");
      return;
    }
    const data = await response.json();
    localStorage.setItem(tokenKey, data.token);
    onToken(data.token);
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <h1>humen-mcp</h1>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label>
          Password
          <input
            value={pass}
            onChange={(event) => setPass(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">
          <Check size={18} /> Admin sign in
        </button>
        {authConfig.github_enabled && (
          <a className="oauth" href={apiPath("/api/auth/oauth/github/start")}>
            <Github size={18} /> GitHub
          </a>
        )}
      </form>
    </main>
  );
}

function TaskPanel({ request, token, afterSubmit }: { request: HumanRequest; token: string; afterSubmit: () => void }) {
  const [answer, setAnswer] = useState(request.choices[0] ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAnswer(request.choices[0] ?? "");
    setNote("");
  }, [request.id]);

  async function submit() {
    setSubmitting(true);
    await fetch(apiPath(`/api/requests/${request.id}/answer`), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ answer, note: note || null })
    });
    setSubmitting(false);
    afterSubmit();
  }

  return (
    <article className="task">
      <header>
        <TaskIcon kind={request.kind} />
        <div>
          <h2>{request.title}</h2>
          <p>{request.prompt}</p>
        </div>
      </header>

      {request.image_url && (
        <figure className="imagePreview">
          <img src={request.image_url} alt="" />
        </figure>
      )}

      {request.steps.length > 0 && (
        <ol className="steps">
          {request.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {request.choices.length > 0 ? (
        <div className="choices">
          {request.choices.map((choice) => (
            <button key={choice} className={answer === choice ? "chosen" : ""} onClick={() => setAnswer(choice)}>
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer" />
      )}

      <textarea className="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" />

      <footer>
        <span>{request.timeout_seconds}s timeout</span>
        <button className="primary" onClick={submit} disabled={submitting || !answer.trim()}>
          <Send size={18} /> Send answer
        </button>
      </footer>
    </article>
  );
}

function TaskIcon({ kind }: { kind: TaskKind }) {
  if (kind === "image_review") return <Image size={18} />;
  if (kind === "steps") return <ListChecks size={18} />;
  return <MessageSquareText size={18} />;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

function refresh(token: string, setRequests: (requests: HumanRequest[]) => void, setBusy: (busy: boolean) => void) {
  setBusy(true);
  fetch(apiPath("/api/requests"), { headers: authHeaders(token) })
    .then((response) => response.json())
    .then(setRequests)
    .finally(() => setBusy(false));
}

function upsertRequest(current: HumanRequest[], next: HumanRequest) {
  const without = current.filter((request) => request.id !== next.id);
  return [...without, next].sort((a, b) => a.created_at - b.created_at);
}

function logout(
  setToken: (token: string) => void,
  setUser: (user: User | null) => void,
  setRequests: (requests: HumanRequest[]) => void
) {
  localStorage.removeItem(tokenKey);
  setToken("");
  setUser(null);
  setRequests([]);
}

createRoot(document.getElementById("root")!).render(<App />);
