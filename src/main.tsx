import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Ban,
  Check,
  Clock3,
  Github,
  Inbox,
  ListChecks,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Tags,
  Trash2,
  UserCircle,
  UserPlus,
  Users
} from "lucide-react";
import "./styles.css";

type TaskKind = "choice" | "text" | "image_review" | "steps";
type View = "inbox" | "trash" | "directory" | "tags" | "settings";

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
  expires_at: number;
  tags: string[];
};

type ExpiredRequest = {
  request: HumanRequest;
  expired_at: number;
  reason: string;
};

type User = {
  email: string;
  provider: "password" | "github";
};

type UserProfile = {
  email: string;
  provider: "password" | "github";
  profile: string;
  tags: string[];
  online: boolean;
  last_login_at: number;
  ban_expires_at?: number | null;
};

type TagStat = {
  tag: string;
  count: number;
};

type AuthConfig = {
  github_enabled: boolean;
  allow_registration?: boolean;
  oauth_channels?: { provider: string; enabled: boolean; client_id: string }[];
};

type AdminSettings = {
  allow_registration: boolean;
  oauth_channels: { provider: string; enabled: boolean; client_id: string }[];
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
  const [view, setView] = useState<View>("inbox");
  const [requests, setRequests] = useState<HumanRequest[]>([]);
  const [trash, setTrash] = useState<ExpiredRequest[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();

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
      .catch(() => logout(setToken, setUser, setRequests, setTrash));
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    refreshAll();
    const ws = new WebSocket(wsPath(token));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setRequests(sortRequests(message.requests ?? []));
        setOnlineCount(message.online_count ?? 0);
      }
      if (message.type === "request_created") {
        setRequests((current) => upsertRequest(current, message.request));
      }
      if (message.type === "request_answered") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
      }
      if (message.type === "request_expired") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
        setTrash((current) => sortTrash([message.expired_request, ...current]));
      }
      if (message.type === "trash_cleaned") {
        refreshTrash(token, setTrash);
      }
      if (message.type === "presence_changed") {
        setOnlineCount(message.online_count);
        refreshUsers(token, setOnlineUsers, setDirectory, setTagStats);
      }
    };
    return () => ws.close();
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;
    const handle = window.setTimeout(() => {
      refreshDirectory(token, setDirectory, query);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, token, user]);

  function refreshAll() {
    if (!token) return;
    setBusy(true);
    Promise.all([
      refreshRequests(token, setRequests),
      refreshTrash(token, setTrash),
      refreshUsers(token, setOnlineUsers, setDirectory, setTagStats),
      refreshAdmin(token, setIsAdmin, setAdminUsers, setAdminSettings)
    ]).finally(() => setBusy(false));
  }

  if (!token || !user) {
    return <Login onToken={setToken} />;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>humen-mcp</h1>
            <p>{onlineCount} online</p>
          </div>
          <button className="iconButton" title="Refresh" onClick={refreshAll}>
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </div>

        <nav className="navList">
          <NavButton icon={<Inbox size={18} />} label="Inbox" count={requests.length} active={view === "inbox"} onClick={() => setView("inbox")} />
          <NavButton icon={<Trash2 size={18} />} label="Trash" count={trash.length} active={view === "trash"} onClick={() => setView("trash")} />
          <NavButton icon={<Users size={18} />} label="Directory" count={onlineUsers.length} active={view === "directory"} onClick={() => setView("directory")} />
          <NavButton icon={<Tags size={18} />} label="Tags" count={tagStats.length} active={view === "tags"} onClick={() => setView("tags")} />
          {isAdmin && <NavButton icon={<Shield size={18} />} label="Admin" active={view === "settings"} onClick={() => setView("settings")} />}
        </nav>

        {view === "inbox" && (
          <div className="requestList">
            {requests.map((request) => (
              <EnvelopeButton
                key={request.id}
                request={request}
                now={now}
                active={selected?.id === request.id}
                onClick={() => setSelectedId(request.id)}
              />
            ))}
            {requests.length === 0 && <div className="empty">No pending envelopes</div>}
          </div>
        )}

        {view === "trash" && (
          <div className="requestList">
            {trash.map((entry) => (
              <button key={entry.request.id} className="requestItem expired">
                <Trash2 size={18} />
                <span>
                  <strong>{entry.request.title}</strong>
                  <small>{formatAge(now - entry.expired_at)} ago</small>
                </span>
              </button>
            ))}
            {trash.length === 0 && <div className="empty">Trash is empty</div>}
          </div>
        )}
      </aside>

      <section className="workspace">
        <TopBar user={user} isAdmin={isAdmin} onSettings={() => setView("settings")} onLogout={() => logout(setToken, setUser, setRequests, setTrash)} />
        {view === "inbox" && (selected ? <TaskPanel request={selected} token={token} now={now} afterSubmit={() => setSelectedId(null)} /> : <Blank />)}
        {view === "trash" && <TrashView trash={trash} token={token} setTrash={setTrash} />}
        {view === "directory" && <DirectoryView query={query} setQuery={setQuery} users={directory} tags={tagStats} />}
        {view === "tags" && <TagsView tags={tagStats} setQuery={setQuery} setView={setView} />}
        {view === "settings" && isAdmin && adminSettings && (
          <AdminView
            token={token}
            users={adminUsers}
            settings={adminSettings}
            setUsers={setAdminUsers}
            setSettings={setAdminSettings}
          />
        )}
        {view === "settings" && !isAdmin && <AccountView user={user} />}
      </section>
    </main>
  );
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ github_enabled: false, allow_registration: true });

  useEffect(() => {
    fetch(apiPath("/api/auth/config"))
      .then((response) => response.json())
      .then((config) => setAuthConfig(config))
      .catch(() => setAuthConfig({ github_enabled: false, allow_registration: false, oauth_channels: [] }));
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
          <input value={pass} onChange={(event) => setPass(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">
          <Check size={18} /> Admin sign in
        </button>
        <OAuthLoginButtons config={authConfig} />
      </form>
    </main>
  );
}

function OAuthLoginButtons({ config }: { config: AuthConfig }) {
  const channels = (config.oauth_channels ?? [])
    .filter((channel) => channel.enabled)
    .filter((channel, index, all) => all.findIndex((candidate) => candidate.provider === channel.provider) === index);
  const fallback = config.github_enabled ? [{ provider: "github", enabled: true, client_id: "" }] : [];
  const visible = channels.length > 0 ? channels : fallback;
  if (visible.length === 0) return null;

  return (
    <div className="oauthButtons">
      {visible.map((channel) =>
        channel.provider === "github" ? (
          <a className="oauth" key={channel.provider} href={apiPath("/api/auth/oauth/github/start")}>
            <Github size={18} /> GitHub
          </a>
        ) : (
          <button className="oauth disabled" key={channel.provider} type="button" disabled>
            <Shield size={18} /> {channel.provider}
          </button>
        )
      )}
    </div>
  );
}

function NavButton({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`navButton ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {count !== undefined && <strong>{count}</strong>}
    </button>
  );
}

function EnvelopeButton({ request, now, active, onClick }: { request: HumanRequest; now: number; active: boolean; onClick: () => void }) {
  const expired = now >= request.expires_at;
  return (
    <button className={`requestItem ${active ? "active" : ""} ${expired ? "expired" : ""}`} onClick={onClick}>
      <TaskIcon kind={request.kind} />
      <span>
        <strong>{request.title}</strong>
        <small>
          <Countdown request={request} now={now} />
        </small>
      </span>
    </button>
  );
}

function TopBar({ user, isAdmin, onSettings, onLogout }: { user: User; isAdmin: boolean; onSettings: () => void; onLogout: () => void }) {
  return (
    <header className="topbar">
      <div>
        <span className="mode">{isAdmin ? "Administrator" : "Human"}</span>
      </div>
      <div className="userMenu">
        <button className="avatarButton" title={user.email} onClick={onSettings}>
          <UserCircle size={22} />
          <span>{initials(user.email)}</span>
        </button>
        <button className="iconButton" title="Settings" onClick={onSettings}>
          <Settings size={18} />
        </button>
        <button className="iconButton" title="Log out" onClick={onLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function TaskPanel({ request, token, now, afterSubmit }: { request: HumanRequest; token: string; now: number; afterSubmit: () => void }) {
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
      <header className="taskHeader">
        <TaskIcon kind={request.kind} />
        <div>
          <h2>{request.title}</h2>
          <p>{request.prompt}</p>
          <div className="metaRow">
            <span><Clock3 size={15} /> <Countdown request={request} now={now} /></span>
            {request.tags.map((tag) => <span key={tag} className="tagPill">{tag}</span>)}
          </div>
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
        <button className="primary" onClick={submit} disabled={submitting || !answer.trim() || now >= request.expires_at}>
          <Send size={18} /> Send answer
        </button>
      </footer>
    </article>
  );
}

function TrashView({ trash, token, setTrash }: { trash: ExpiredRequest[]; token: string; setTrash: (trash: ExpiredRequest[]) => void }) {
  async function clear() {
    await fetch(apiPath("/api/trash/clear"), { method: "POST", headers: authHeaders(token) });
    setTrash([]);
  }

  return (
    <section className="page">
      <div className="pageTitle">
        <h2>Trash</h2>
        <button className="secondary" onClick={clear} disabled={trash.length === 0}>
          <Trash2 size={17} /> Clear
        </button>
      </div>
      <div className="gridList">
        {trash.map((entry) => (
          <article className="listCard" key={entry.request.id}>
            <div className="cardHead">
              <Trash2 size={18} />
              <strong>{entry.request.title}</strong>
            </div>
            <p>{entry.reason}</p>
            <small>{formatTime(entry.expired_at)}</small>
            <div className="tagRow">{entry.request.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </article>
        ))}
        {trash.length === 0 && <Blank text="No expired envelopes" />}
      </div>
    </section>
  );
}

function DirectoryView({ query, setQuery, users, tags }: { query: string; setQuery: (query: string) => void; users: UserProfile[]; tags: TagStat[] }) {
  return (
    <section className="page">
      <div className="pageTitle">
        <h2>Humans</h2>
        <label className="searchBox">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search profile or #tag" />
        </label>
      </div>
      <div className="tagStrip">
        {tags.slice(0, 10).map((tag) => (
          <button key={tag.tag} onClick={() => setQuery(tag.tag)}>
            {tag.tag} <span>{tag.count}</span>
          </button>
        ))}
      </div>
      <div className="gridList">
        {users.map((profile) => <UserCard key={profile.email} profile={profile} />)}
        {users.length === 0 && <Blank text="No humans found" />}
      </div>
    </section>
  );
}

function TagsView({ tags, setQuery, setView }: { tags: TagStat[]; setQuery: (query: string) => void; setView: (view: View) => void }) {
  return (
    <section className="page">
      <div className="pageTitle">
        <h2>Tags</h2>
      </div>
      <div className="tagCloud">
        {tags.map((tag) => (
          <button key={tag.tag} onClick={() => { setQuery(tag.tag); setView("directory"); }}>
            {tag.tag}
            <span>{tag.count}</span>
          </button>
        ))}
        {tags.length === 0 && <Blank text="No tags yet" />}
      </div>
    </section>
  );
}

function AdminView({ token, users, settings, setUsers, setSettings }: { token: string; users: UserProfile[]; settings: AdminSettings; setUsers: (users: UserProfile[]) => void; setSettings: (settings: AdminSettings) => void }) {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState("");
  const [tags, setTags] = useState("");
  const [oauthProvider, setOauthProvider] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");

  async function addUser(event: FormEvent) {
    event.preventDefault();
    await fetch(apiPath("/api/admin/users"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ email, profile, tags: splitTags(tags) })
    });
    setEmail("");
    setProfile("");
    setTags("");
    refreshAdmin(token, () => {}, setUsers, setSettings);
  }

  async function saveSettings(next: AdminSettings) {
    setSettings(next);
    const response = await fetch(apiPath("/api/admin/settings"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(next)
    });
    if (response.ok) setSettings(await response.json());
  }

  function addOAuthChannel(event: FormEvent) {
    event.preventDefault();
    const provider = oauthProvider.trim().toLowerCase();
    if (!provider) return;
    const nextChannels = settings.oauth_channels.filter((channel) => channel.provider !== provider);
    nextChannels.push({ provider, enabled: false, client_id: oauthClientId.trim() });
    setOauthProvider("");
    setOauthClientId("");
    saveSettings({ ...settings, oauth_channels: nextChannels });
  }

  return (
    <section className="page adminPage">
      <div className="pageTitle">
        <h2>Settings</h2>
      </div>

      <section className="panel">
        <div className="panelHead">
          <Shield size={18} />
          <h3>Registration</h3>
        </div>
        <label className="toggleRow">
          <span>Allow new users</span>
          <input
            type="checkbox"
            checked={settings.allow_registration}
            onChange={(event) => saveSettings({ ...settings, allow_registration: event.target.checked })}
          />
        </label>
      </section>

      <section className="panel">
        <div className="panelHead">
          <Github size={18} />
          <h3>OAuth Channels</h3>
        </div>
        {settings.oauth_channels.map((channel, index) => (
          <div className="oauthRow" key={channel.provider}>
            <label>
              <span>{channel.provider}</span>
              <input
                value={channel.client_id}
                onChange={(event) => {
                  const next = [...settings.oauth_channels];
                  next[index] = { ...channel, client_id: event.target.value };
                  setSettings({ ...settings, oauth_channels: next });
                }}
                placeholder="Client ID"
              />
            </label>
            <button
              className="secondary"
              onClick={() => saveSettings({ ...settings, oauth_channels: settings.oauth_channels })}
            >
              <Check size={16} /> Save
            </button>
            <button
              className="secondary"
              onClick={() =>
                saveSettings({
                  ...settings,
                  oauth_channels: settings.oauth_channels.filter((candidate) => candidate.provider !== channel.provider)
                })
              }
            >
              <Trash2 size={16} /> Remove
            </button>
            <label className="toggleRow compact">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={channel.enabled}
                onChange={(event) => {
                  const next = [...settings.oauth_channels];
                  next[index] = { ...channel, enabled: event.target.checked };
                  saveSettings({ ...settings, oauth_channels: next });
                }}
              />
            </label>
          </div>
        ))}
        <form className="oauthAddRow" onSubmit={addOAuthChannel}>
          <input value={oauthProvider} onChange={(event) => setOauthProvider(event.target.value)} placeholder="provider, e.g. google" />
          <input value={oauthClientId} onChange={(event) => setOauthClientId(event.target.value)} placeholder="client id" />
          <button className="secondary" disabled={!oauthProvider.trim()}>
            <UserPlus size={16} /> Add channel
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panelHead">
          <UserPlus size={18} />
          <h3>Add User</h3>
        </div>
        <form className="adminForm" onSubmit={addUser}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email or login" />
          <input value={profile} onChange={(event) => setProfile(event.target.value)} placeholder="profile" />
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="#ops #review" />
          <button className="primary" disabled={!email.trim()}>
            <UserPlus size={17} /> Add
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panelHead">
          <Users size={18} />
          <h3>Users</h3>
        </div>
        <div className="userTable">
          {users.map((profile) => (
            <AdminUserRow key={profile.email} profile={profile} token={token} afterChange={() => refreshAdmin(token, () => {}, setUsers, setSettings)} />
          ))}
        </div>
      </section>
    </section>
  );
}

function AdminUserRow({ profile, token, afterChange }: { profile: UserProfile; token: string; afterChange: () => void }) {
  const [banUntil, setBanUntil] = useState("");
  const [editProfile, setEditProfile] = useState(profile.profile);
  const [editTags, setEditTags] = useState(profile.tags.join(" "));

  async function patch(body: unknown) {
    await fetch(apiPath(`/api/admin/users/${encodeURIComponent(profile.email)}`), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    afterChange();
  }

  async function kick() {
    await fetch(apiPath(`/api/admin/users/${encodeURIComponent(profile.email)}/kick`), {
      method: "POST",
      headers: authHeaders(token)
    });
    afterChange();
  }

  function applyCustomBan() {
    if (!banUntil) return;
    const unix = Math.floor(new Date(banUntil).getTime() / 1000);
    if (Number.isFinite(unix)) {
      patch({ ban_expires_at: unix });
    }
  }

  function saveProfile() {
    patch({ profile: editProfile, tags: splitTags(editTags) });
  }

  return (
    <div className="userRow">
      <UserCard profile={profile} />
      <div className="userEdit">
        <input value={editProfile} onChange={(event) => setEditProfile(event.target.value)} placeholder="profile" />
        <input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="#ops #review" />
        <button className="secondary" onClick={saveProfile}>
          <Check size={16} /> Save profile
        </button>
      </div>
      <div className="rowActions">
        <label className="banUntil">
          <span>Ban until</span>
          <input type="datetime-local" value={banUntil} onChange={(event) => setBanUntil(event.target.value)} />
        </label>
        <button className="secondary" onClick={applyCustomBan} disabled={!banUntil}>
          <Ban size={16} /> Set
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: Math.floor(Date.now() / 1000) + 3600 })}>
          <Ban size={16} /> 1h
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: Math.floor(Date.now() / 1000) + 86400 })}>
          <Ban size={16} /> 24h
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: null })}>
          <Check size={16} /> Unban
        </button>
        <button className="secondary" onClick={kick}>
          <LogOut size={16} /> Kick
        </button>
      </div>
    </div>
  );
}

function AccountView({ user }: { user: User }) {
  return (
    <section className="page">
      <div className="pageTitle">
        <h2>Settings</h2>
      </div>
      <section className="panel accountPanel">
        <div className="avatarCircle large">{initials(user.email)}</div>
        <div>
          <h3>{user.email}</h3>
          <p>{user.provider} login</p>
        </div>
      </section>
    </section>
  );
}

function UserCard({ profile }: { profile: UserProfile }) {
  const banned = profile.ban_expires_at && profile.ban_expires_at > Math.floor(Date.now() / 1000);
  return (
    <article className="userCard">
      <div className="avatarCircle">{initials(profile.email)}</div>
      <div>
        <strong>{profile.email}</strong>
        <p>{profile.profile || "No profile"}</p>
        <div className="metaRow">
          <span className={profile.online ? "status onlineStatus" : "status"}>{profile.online ? "online" : "offline"}</span>
          <span>{profile.provider}</span>
          {banned && <span className="dangerText">banned until {formatTime(profile.ban_expires_at!)}</span>}
        </div>
        <div className="tagRow">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      </div>
    </article>
  );
}

function Blank({ text = "Waiting for agent requests" }: { text?: string }) {
  return (
    <div className="blank">
      <MessageSquareText size={32} />
      <span>{text}</span>
    </div>
  );
}

function TaskIcon({ kind }: { kind: TaskKind }) {
  if (kind === "steps") return <ListChecks size={18} />;
  return <MessageSquareText size={18} />;
}

function Countdown({ request, now }: { request: HumanRequest; now: number }) {
  const remaining = Math.max(0, request.expires_at - now);
  if (remaining === 0) return <span className="countdown expired">expired</span>;
  return <span className={remaining <= 30 ? "countdown urgent" : "countdown"}>{formatDuration(remaining)}</span>;
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(handle);
  }, []);
  return now;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function refreshRequests(token: string, setRequests: (requests: HumanRequest[]) => void) {
  const response = await fetch(apiPath("/api/requests"), { headers: authHeaders(token) });
  if (response.ok) setRequests(sortRequests(await response.json()));
}

async function refreshTrash(token: string, setTrash: (trash: ExpiredRequest[]) => void) {
  const response = await fetch(apiPath("/api/trash"), { headers: authHeaders(token) });
  if (response.ok) setTrash(sortTrash(await response.json()));
}

async function refreshUsers(token: string, setOnline: (users: UserProfile[]) => void, setDirectory: (users: UserProfile[]) => void, setTags: (tags: TagStat[]) => void) {
  const [online, users, tags] = await Promise.all([
    fetch(apiPath("/api/users/online"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/users/search"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/tags"), { headers: authHeaders(token) })
  ]);
  if (online.ok) setOnline(await online.json());
  if (users.ok) setDirectory(await users.json());
  if (tags.ok) setTags((await tags.json()).tags ?? []);
}

async function refreshDirectory(token: string, setDirectory: (users: UserProfile[]) => void, query: string) {
  const params = query.trim().startsWith("#") ? `?tag=${encodeURIComponent(query.trim())}` : `?q=${encodeURIComponent(query.trim())}`;
  const response = await fetch(apiPath(`/api/users/search${query.trim() ? params : ""}`), { headers: authHeaders(token) });
  if (response.ok) setDirectory(await response.json());
}

async function refreshAdmin(token: string, setIsAdmin: (isAdmin: boolean) => void, setUsers: (users: UserProfile[]) => void, setSettings: (settings: AdminSettings) => void) {
  const [users, settings] = await Promise.all([
    fetch(apiPath("/api/admin/users"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/admin/settings"), { headers: authHeaders(token) })
  ]);
  if (users.ok && settings.ok) {
    setIsAdmin(true);
    setUsers(await users.json());
    setSettings(await settings.json());
  } else {
    setIsAdmin(false);
  }
}

function upsertRequest(current: HumanRequest[], next: HumanRequest) {
  const without = current.filter((request) => request.id !== next.id);
  return sortRequests([...without, next]);
}

function sortRequests(requests: HumanRequest[]) {
  return [...requests].sort((a, b) => a.expires_at - b.expires_at);
}

function sortTrash(trash: ExpiredRequest[]) {
  return [...trash].sort((a, b) => b.expired_at - a.expired_at);
}

function splitTags(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function formatTime(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

function logout(
  setToken: (token: string) => void,
  setUser: (user: User | null) => void,
  setRequests: (requests: HumanRequest[]) => void,
  setTrash: (trash: ExpiredRequest[]) => void
) {
  localStorage.removeItem(tokenKey);
  setToken("");
  setUser(null);
  setRequests([]);
  setTrash([]);
}

createRoot(document.getElementById("root")!).render(<App />);
