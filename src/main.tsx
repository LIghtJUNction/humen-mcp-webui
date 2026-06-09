import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Ban,
  Check,
  Clock3,
  Github,
  Inbox,
  KeyRound,
  Languages,
  ListChecks,
  LogOut,
  MessageSquareText,
  Moon,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Sun,
  Tags,
  Trash2,
  UserCircle,
  UserPlus,
  Users,
  Webhook,
  X
} from "lucide-react";
import "./styles.css";

type TaskKind = "choice" | "judgment" | "text" | "image_review" | "steps";
type View = "inbox" | "tasks" | "sent" | "trash" | "directory" | "tags" | "agent" | "webhooks" | "settings";

type HumanRequest = {
  id: string;
  kind: TaskKind;
  title: string;
  prompt: string;
  choices: string[];
  image_url?: string | null;
  image_base64?: string | null;
  image_mime_type?: string | null;
  steps: string[];
  created_at: number;
  timeout_seconds: number;
  expires_at: number;
  tags: string[];
  assigned_to?: string | null;
};

type ExpiredRequest = {
  request: HumanRequest;
  expired_at: number;
  reason: string;
};

type HumanAnswer = {
  answer: string;
  note?: string | null;
  answered_by: string;
  answered_at: number;
};

type AnsweredRequest = {
  request: HumanRequest;
  answer: HumanAnswer;
  answered_late: boolean;
};

type AgentTaskStatus = "open" | "in_progress" | "done" | "archived";

type AgentTask = {
  id: string;
  title: string;
  description: string;
  steps: string[];
  tags: string[];
  created_by: string;
  assigned_to: string;
  created_at: number;
  updated_at: number;
  due_at?: number | null;
  status: AgentTaskStatus;
  human_note?: string | null;
  completed_at?: number | null;
};

type User = {
  email: string;
  provider: "password" | "github" | "passkey";
};

type UserProfile = {
  email: string;
  provider: "password" | "github" | "passkey";
  profile: string;
  tags: string[];
  friend_code?: string;
  intro_code: string;
  is_public: boolean;
  is_friend: boolean;
  friend_request_sent: boolean;
  friend_request_received: boolean;
  onboarding_completed: boolean;
  online: boolean;
  last_login_at: number;
  ban_expires_at?: number | null;
};

type FriendBundle = {
  friends: UserProfile[];
  incoming: UserProfile[];
  outgoing: UserProfile[];
};

type TagStat = {
  tag: string;
  count: number;
};

type OAuthChannelConfig = {
  provider: string;
  enabled: boolean;
  client_id: string;
  client_secret?: string;
};

type PublicKeyCredentialDescriptorJSON = Omit<PublicKeyCredentialDescriptor, "id"> & {
  id: string;
};

type PublicKeyCredentialCreationOptionsJSON = Omit<
  PublicKeyCredentialCreationOptions,
  "challenge" | "user" | "excludeCredentials"
> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
};

type PublicKeyCredentialRequestOptionsJSON = Omit<
  PublicKeyCredentialRequestOptions,
  "challenge" | "allowCredentials"
> & {
  challenge: string;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
};

type AuthConfig = {
  github_enabled: boolean;
  passkey_enabled?: boolean;
  allow_registration?: boolean;
  oauth_channels?: OAuthChannelConfig[];
};

type PasskeyInfo = {
  id: string;
  name: string;
  created_at: number;
  last_used_at?: number | null;
};

type PasskeyRegistrationStart = {
  registration_id: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

type PasskeyAuthenticationStart = {
  authentication_id: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};

type WebhookConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  secret?: string | null;
  kind: "generic" | "wechat" | string;
  help_prompt?: string;
  weixin_qrcode?: string | null;
  weixin_qrcode_url?: string | null;
  weixin_status?: string | null;
  weixin_status_message?: string | null;
  weixin_bot_token?: string | null;
  weixin_account_id?: string | null;
  weixin_base_url?: string | null;
  weixin_user_id?: string | null;
  weixin_get_updates_buf?: string | null;
  weixin_last_error?: string | null;
  weixin_last_seen_at?: number | null;
  weixin_long_poll_timeout_ms?: number | null;
  weixin_api_timeout_ms?: number | null;
};

type AdminSettings = {
  allow_registration: boolean;
  oauth_channels: OAuthChannelConfig[];
  agent_secret_prefix?: string | null;
  allow_agent_directory: boolean;
  webhooks?: WebhookConfig[];
};

type AgentAccess = {
  user: string;
  mcp_url: string;
  secret_required: boolean;
  agent_secret_prefix: string;
  user_agent_secret: string;
  agent_secret: string;
  allow_agent_directory: boolean;
  friend_code?: string;
  intro_code: string;
  is_public: boolean;
  onboarding_completed: boolean;
};

const tokenKey = "humen-mcp-token";
const preferencesKey = "humen-mcp-preferences";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const sourceUrl = "https://github.com/LIghtJUNction/humen-mcp";
const reservedTags = new Set(["#admin"]);
const defaultWebhookHelpPrompt = `直接回复本消息就是回答。
如果问题积压，请引用对应问题回复，系统会优先匹配引用中的 请求ID 或 [humen:短ID]。
网页处理地址：{url}
请求ID：{request_id}
短ID：{short_id}`;

type Theme = "light" | "dark";
type Language = "zh" | "en";

type Preferences = {
  displayName: string;
  avatarText: string;
  avatarColor: string;
  theme: Theme;
  language: Language;
  compact: boolean;
};

const defaultPreferences: Preferences = {
  displayName: "",
  avatarText: "",
  avatarColor: "#2e7a55",
  theme: "light",
  language: "zh",
  compact: false
};

const profileTemplate = `Hi, I can help with human-in-the-loop checks.

Skills: #review #ops #qa
Available for: approvals, UI checks, account actions, short research
Language/timezone:
Escalation notes:`;

const oauthPresets = [
  {
    provider: "github",
    label: "GitHub",
    docsUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
  },
  {
    provider: "google",
    label: "Google",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2/web-server"
  },
  {
    provider: "microsoft",
    label: "Microsoft",
    docsUrl: "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
  },
  {
    provider: "gitlab",
    label: "GitLab",
    docsUrl: "https://docs.gitlab.com/integration/oauth_provider/"
  }
];

const zhText: Record<string, string> = {
  online: "在线",
  refresh: "刷新",
  inbox: "收件箱",
  tasks: "任务",
  sent: "成功发送",
  trash: "回收站",
  directory: "用户目录",
  tags: "标签",
  agent: "接入 Agent",
  adminSettings: "管理与设置",
  settings: "设置",
  sourceCode: "GitHub 源代码",
  noPending: "暂无待处理信封",
  noTasks: "暂无 AI 创建的任务",
  sentEmpty: "暂无成功发送",
  trashEmpty: "回收站为空",
  noExpired: "没有过期信封",
  waiting: "等待 agent 请求",
  email: "邮箱",
  password: "密码",
  adminSignIn: "管理员登录",
  adminLoginFailed: "管理员登录失败",
  passkeySignIn: "使用 Passkey 登录",
  passkeyUseEmail: "请先输入邮箱，再使用 Passkey 登录。",
  passkeyUnsupported: "当前浏览器或当前站点不支持 Passkey。",
  passkeyLoginFailed: "Passkey 登录失败",
  passkeys: "Passkeys",
  passkeyHelp: "登录后可在当前设备或密码管理器中绑定 Passkey；下次输入邮箱后即可无密码登录。",
  addPasskey: "绑定 Passkey",
  passkeyName: "Passkey 名称",
  noPasskeys: "尚未绑定 Passkey",
  removePasskey: "删除 Passkey",
  passkeyAdded: "Passkey 已绑定。",
  passkeyRemoved: "Passkey 已删除。",
  passkeyRegisterFailed: "Passkey 绑定失败",
  administrator: "管理员",
  human: "用户",
  user: "用户",
  light: "亮色",
  dark: "暗色",
  switchDark: "切换到暗色",
  switchLight: "切换到亮色",
  logout: "退出登录",
  answer: "回答",
  note: "备注",
  sendAnswer: "发送回答",
  timeout: "超时",
  expired: "已过期",
  clear: "清空",
  humans: "用户",
  searchProfile: "搜索简介或 #标签",
  introCode: "好友代码",
  addByIntroCode: "按好友代码添加好友",
  addFriend: "添加好友",
  acceptFriend: "接受好友",
  removeFriend: "移除好友",
  friendPending: "已发送申请",
  friends: "好友",
  incomingRequests: "收到的申请",
  outgoingRequests: "已发送申请",
  noHumans: "没有找到用户",
  noTags: "暂无标签",
  profileMissing: "暂无简介",
  onlineStatus: "在线",
  offlineStatus: "离线",
  settingsSubtitle: "主题、语言和个人显示偏好",
  adminSubtitle: "个性化、OAuth、注册和用户管理",
  updatePanel: "更新面板",
  update: "更新",
  personalization: "个性化",
  displayName: "显示名",
  avatarText: "头像文字",
  avatarColor: "头像颜色",
  compact: "紧凑模式",
  reset: "重置",
  publicProfile: "个人简介",
  profileHelp: "Agent 可以搜索这个简介和 #标签，建议说明能力、可用时间和注意事项。",
  onboardingTitle: "首次配置",
  onboardingHelp: "完成简介、标签、公开状态和好友代码确认后，Agent 才能稳定地把任务和好友关系关联到你。",
  publicUser: "公开出现在用户目录",
  privateUserHelp: "关闭公开后，别人只能通过好友代码发送好友申请；好友仍然能看到你。",
  profile: "简介",
  useTemplate: "使用模板",
  saveProfile: "保存简介",
  savingProfile: "正在保存简介...",
  profileSaved: "简介已保存。",
  saveProfileFailed: "保存简介失败",
  registration: "注册",
  allowNewUsers: "允许新用户注册",
  oauthChannels: "OAuth 渠道",
  oauthHelp: "通用 OAuth 渠道。把回调 URL 填到对应 OAuth App 的 Callback/Redirect URI。",
  callbackExample: "回调 URL 示例：",
  addChannel: "添加渠道",
  enabled: "启用",
  save: "保存",
  remove: "移除",
  saved: "已保存。",
  saving: "正在保存...",
  saveFailed: "保存失败。",
  users: "用户",
  saveUserProfile: "保存用户简介",
  banUntil: "封禁到",
  set: "设置",
  unban: "解封",
  kick: "踢出",
  agentTitle: "接入 Agent",
  agentSubtitle: "把 humen-mcp 添加到 Codex、Claude Code 或任何支持 MCP 的 Agent 软件。",
  secretMcp: "此 MCP 服务器强制要求 Agent Secret。",
  adminAgentSecret: "管理员：Secret 前缀",
  agentSecretHelp: "最终 secret = 管理员前缀 + 你的个人 secret。管理员轮换前缀会让全部旧 secret 失效。",
  personalAgentSecret: "个人 Agent Secret",
  allowAgentDirectory: "允许 Agent 查看所有人类",
  allowAgentDirectoryRisk: "风险：开启后，任何拿到有效 secret 的 Agent 都可以搜索全部用户目录，而不只看到自己的账号。",
  random: "随机生成",
  saveSecret: "保存 secret",
  savingAgent: "正在保存 Agent 访问配置...",
  agentSaved: "Agent 访问配置已保存。",
  configExamples: "配置示例",
  copyInstallPromptHelp: "复制安装提示词，直接粘贴给 Codex / Claude Code / 其他 Agent。",
  copyInstallPrompt: "一键复制安装提示词",
  installPrompt: "安装提示词",
  copied: "已复制。",
  copyFailed: "复制失败，请手动选择复制。",
  oauthGuide: "OAuth 配置步骤指南",
  commonFlow: "通用流程",
  currentCallbacks: "当前回调地址",
  presetDocs: "预设平台入口",
  providerNotes: "Provider 注意事项",
  importantNotes: "重要注意事项"
};

const enText: Record<string, string> = {
  online: "online",
  refresh: "Refresh",
  inbox: "Inbox",
  tasks: "Tasks",
  sent: "Sent",
  trash: "Trash",
  directory: "Directory",
  tags: "Tags",
  agent: "Connect Agent",
  adminSettings: "Admin & Settings",
  settings: "Settings",
  sourceCode: "GitHub source",
  noPending: "No pending envelopes",
  noTasks: "No AI-created tasks",
  sentEmpty: "No sent replies",
  trashEmpty: "Trash is empty",
  noExpired: "No expired envelopes",
  waiting: "Waiting for agent requests",
  email: "Email",
  password: "Password",
  adminSignIn: "Admin sign in",
  adminLoginFailed: "Admin login failed",
  passkeySignIn: "Sign in with Passkey",
  passkeyUseEmail: "Enter your email before signing in with a passkey.",
  passkeyUnsupported: "This browser or origin does not support passkeys.",
  passkeyLoginFailed: "Passkey sign-in failed",
  passkeys: "Passkeys",
  passkeyHelp: "After signing in, bind a passkey on this device or password manager. Next time, enter your email and sign in without a password.",
  addPasskey: "Add passkey",
  passkeyName: "Passkey name",
  noPasskeys: "No passkeys added",
  removePasskey: "Remove passkey",
  passkeyAdded: "Passkey added.",
  passkeyRemoved: "Passkey removed.",
  passkeyRegisterFailed: "Passkey registration failed",
  administrator: "Administrator",
  human: "Human",
  user: "User",
  light: "Light",
  dark: "Dark",
  switchDark: "Switch to dark mode",
  switchLight: "Switch to light mode",
  logout: "Log out",
  answer: "Answer",
  note: "Note",
  sendAnswer: "Send answer",
  timeout: "timeout",
  expired: "expired",
  clear: "Clear",
  humans: "Humans",
  searchProfile: "Search profile or #tag",
  introCode: "Friend code",
  addByIntroCode: "Add by friend code",
  addFriend: "Add friend",
  acceptFriend: "Accept friend",
  removeFriend: "Remove friend",
  friendPending: "Request sent",
  friends: "Friends",
  incomingRequests: "Incoming requests",
  outgoingRequests: "Outgoing requests",
  noHumans: "No humans found",
  noTags: "No tags yet",
  profileMissing: "No profile",
  onlineStatus: "online",
  offlineStatus: "offline",
  settingsSubtitle: "Theme, language, and personal display preferences",
  adminSubtitle: "Personalization, OAuth, registration, and user management",
  updatePanel: "Refresh panel",
  update: "Refresh",
  personalization: "Personalization",
  displayName: "Display name",
  avatarText: "Avatar text",
  avatarColor: "Avatar color",
  compact: "Compact mode",
  reset: "Reset",
  publicProfile: "Public profile",
  profileHelp: "Agents can search this profile and #tags. Include skills, availability, and notes.",
  onboardingTitle: "First-time setup",
  onboardingHelp: "Confirm your profile, tags, public visibility, and friend code so agents and friends map to your account correctly.",
  publicUser: "Show publicly in the user directory",
  privateUserHelp: "When public is off, others can still send friend requests with your friend code. Friends can still see you.",
  profile: "Profile",
  useTemplate: "Use template",
  saveProfile: "Save profile",
  savingProfile: "Saving profile...",
  profileSaved: "Profile saved.",
  saveProfileFailed: "Save profile failed",
  registration: "Registration",
  allowNewUsers: "Allow new users",
  oauthChannels: "OAuth Channels",
  oauthHelp: "Generic OAuth channels. Put the callback URL into the provider's Callback/Redirect URI.",
  callbackExample: "Callback URL example:",
  addChannel: "Add channel",
  enabled: "Enabled",
  save: "Save",
  remove: "Remove",
  saved: "Saved.",
  saving: "Saving...",
  saveFailed: "Save failed.",
  users: "Users",
  saveUserProfile: "Save user profile",
  banUntil: "Ban until",
  set: "Set",
  unban: "Unban",
  kick: "Kick",
  agentTitle: "Connect Agent",
  agentSubtitle: "Add humen-mcp to Codex, Claude Code, or any MCP-capable agent.",
  secretMcp: "This MCP server always requires an Agent Secret.",
  adminAgentSecret: "Admin: Secret prefix",
  agentSecretHelp: "Final secret = admin prefix + your personal secret. Rotating the prefix invalidates every old secret.",
  personalAgentSecret: "Personal Agent Secret",
  allowAgentDirectory: "Allow agents to see all humans",
  allowAgentDirectoryRisk: "Risk: when enabled, any agent with a valid secret can search the full human directory instead of only its own account.",
  random: "Random",
  saveSecret: "Save secret",
  savingAgent: "Saving agent access...",
  agentSaved: "Agent access saved.",
  configExamples: "Configuration examples",
  copyInstallPromptHelp: "Copy this install prompt and paste it into Codex / Claude Code / another agent.",
  copyInstallPrompt: "Copy install prompt",
  installPrompt: "Install prompt",
  copied: "Copied.",
  copyFailed: "Copy failed. Please select and copy manually.",
  oauthGuide: "OAuth setup guide",
  commonFlow: "Common flow",
  currentCallbacks: "Current callback URLs",
  presetDocs: "Provider docs",
  providerNotes: "Provider notes",
  importantNotes: "Important notes"
};

function t(key: string) {
  return (currentLanguage() === "en" ? enText : zhText)[key] ?? key;
}

function currentLanguage(): Language {
  try {
    return (JSON.parse(localStorage.getItem(preferencesKey) ?? "{}").language as Language) || "zh";
  } catch {
    return "zh";
  }
}

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
  const [preferences, setPreferences] = usePreferences();
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("inbox");
  const [requests, setRequests] = useState<HumanRequest[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [sent, setSent] = useState<AnsweredRequest[]>([]);
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

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.compact = preferences.compact ? "true" : "false";
    document.documentElement.lang = preferences.language;
  }, [preferences.theme, preferences.compact, preferences.language]);

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
      .catch(() => logout(setToken, setUser, setRequests, setTasks, setSent, setTrash));
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    refreshAll();
    const ws = new WebSocket(wsPath(token));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setRequests(sortRequests(message.requests ?? []));
        setTasks(sortAgentTasks(message.tasks ?? []));
        setOnlineCount(message.online_count ?? 0);
      }
      if (message.type === "request_created") {
        setRequests((current) => upsertRequest(current, message.request));
      }
      if (message.type === "request_answered") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
        if (message.request && message.answer) {
          setSent((current) => upsertAnswered(current, {
            request: message.request,
            answer: message.answer,
            answered_late: Boolean(message.answered_late)
          }));
        } else {
          refreshSent(token, setSent);
        }
      }
      if (message.type === "request_expired") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
        setTrash((current) => sortTrash([message.expired_request, ...current]));
      }
      if (message.type === "task_created" || message.type === "task_updated") {
        setTasks((current) => upsertAgentTask(current, message.task));
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
      refreshTasks(token, setTasks),
      refreshSent(token, setSent),
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
            <p>{onlineCount} {t(t("onlineStatus"))}</p>
          </div>
          <button className="iconButton" title={t("refresh")} onClick={refreshAll}>
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </div>

        <nav className="navList">
          <NavButton icon={<Inbox size={18} />} label={t("inbox")} count={requests.length} active={view === "inbox"} onClick={() => setView("inbox")} />
          <NavButton icon={<ListChecks size={18} />} label={t("tasks")} count={tasks.filter((task) => task.status !== "done" && task.status !== "archived").length} active={view === "tasks"} onClick={() => setView("tasks")} />
          <NavButton icon={<Send size={18} />} label={t("sent")} count={sent.length} active={view === "sent"} onClick={() => setView("sent")} />
          <NavButton icon={<Trash2 size={18} />} label={t("trash")} count={trash.length} active={view === "trash"} onClick={() => setView("trash")} />
          <NavButton icon={<Users size={18} />} label={t("directory")} count={onlineUsers.length} active={view === "directory"} onClick={() => setView("directory")} />
          <NavButton icon={<Tags size={18} />} label={t("tags")} count={tagStats.length} active={view === "tags"} onClick={() => setView("tags")} />
          <NavButton icon={<MessageSquareText size={18} />} label={t("agent")} active={view === "agent"} onClick={() => setView("agent")} />
          <NavButton icon={isAdmin ? <Shield size={18} /> : <Settings size={18} />} label={isAdmin ? t("adminSettings") : t("settings")} active={view === "settings"} onClick={() => setView("settings")} />
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
            {requests.length === 0 && <div className="empty">{t("noPending")}</div>}
          </div>
        )}

        {view === "sent" && (
          <div className="requestList">
            {sent.map((entry) => (
              <button key={entry.request.id} className="requestItem sent">
                <Send size={18} />
                <span>
                  <strong>{entry.request.title}</strong>
                  <small>{formatTime(entry.answer.answered_at)}</small>
                </span>
              </button>
            ))}
            {sent.length === 0 && <div className="empty">{t("sentEmpty")}</div>}
          </div>
        )}

        {view === "trash" && (
          <div className="requestList">
            {trash.map((entry) => (
              <button key={entry.request.id} className="requestItem expired">
                <Trash2 size={18} />
                <span>
                  <strong>{entry.request.title}</strong>
                  <small>{formatAge(now - entry.expired_at)} {currentLanguage() === "zh" ? "前" : "ago"}</small>
                </span>
              </button>
            ))}
            {trash.length === 0 && <div className="empty">{t("trashEmpty")}</div>}
          </div>
        )}

        {view === "tasks" && (
          <div className="requestList">
            {tasks.slice(0, 40).map((task) => (
              <button key={task.id} className={`requestItem taskStatus-${task.status}`}>
                <ListChecks size={18} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{taskStatusLabel(task.status)} · {formatTime(task.updated_at)}</small>
                </span>
              </button>
            ))}
            {tasks.length === 0 && <div className="empty">{t("noTasks")}</div>}
          </div>
        )}

        {isAdmin && (
          <div className="sidebarActions">
            <button className={`addWebhookButton ${view === "webhooks" ? "active" : ""}`} onClick={() => setView("webhooks")}>
              <Plus size={18} />
              <span>新增 webhook</span>
            </button>
          </div>
        )}
      </aside>

      <section className="workspace">
        <TopBar
          user={user}
          preferences={preferences}
          setPreferences={setPreferences}
          isAdmin={isAdmin}
          onSettings={() => setView("settings")}
          onLogout={() => logout(setToken, setUser, setRequests, setTasks, setSent, setTrash)}
        />
        {view === "inbox" && (selected ? <TaskPanel request={selected} token={token} now={now} afterSubmit={() => setSelectedId(null)} /> : <Blank />)}
        {view === "tasks" && <AgentTasksView tasks={tasks} token={token} setTasks={setTasks} />}
        {view === "sent" && <SentView sent={sent} />}
        {view === "trash" && <TrashView trash={trash} token={token} setTrash={setTrash} />}
        {view === "directory" && <DirectoryView query={query} setQuery={setQuery} users={directory} tags={tagStats} token={token} currentUser={user.email} onChanged={() => refreshUsers(token, setOnlineUsers, setDirectory, setTagStats)} />}
        {view === "tags" && <TagsView tags={tagStats} setQuery={setQuery} setView={setView} />}
        {view === "agent" && (
          <AgentView
            token={token}
            isAdmin={isAdmin}
            settings={adminSettings}
            setSettings={setAdminSettings}
          />
        )}
        {view === "webhooks" && isAdmin && adminSettings && (
          <WebhookView
            token={token}
            settings={adminSettings}
            setSettings={setAdminSettings}
          />
        )}
        {view === "webhooks" && (!isAdmin || !adminSettings) && <Blank text="Only administrators can manage webhooks" />}
        {view === "settings" && isAdmin && (
          adminSettings ? (
            <AdminView
              token={token}
              user={user}
              preferences={preferences}
              setPreferences={setPreferences}
              users={adminUsers}
              settings={adminSettings}
              setUsers={setAdminUsers}
              setSettings={setAdminSettings}
              onRefresh={refreshAll}
              refreshing={busy}
            />
          ) : (
            <AccountView
              token={token}
              user={user}
              preferences={preferences}
              setPreferences={setPreferences}
              onRefresh={refreshAll}
              refreshing={busy}
              notice="Admin APIs are not available on this backend version yet."
            />
          )
        )}
        {view === "settings" && !isAdmin && (
          <AccountView token={token} user={user} preferences={preferences} setPreferences={setPreferences} onRefresh={refreshAll} refreshing={busy} />
        )}
      </section>
    </main>
  );
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ github_enabled: false, allow_registration: true });

  useEffect(() => {
    fetch(apiPath("/api/auth/config"))
      .then((response) => safeJson<AuthConfig>(response))
      .then((config) => setAuthConfig(config ?? { github_enabled: false, allow_registration: false, oauth_channels: [] }))
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
      setError(t("adminLoginFailed"));
      return;
    }
    const data = await response.json();
    localStorage.setItem(tokenKey, data.token);
    onToken(data.token);
  }

  async function signInWithPasskey() {
    setError("");
    if (!passkeysSupported() || authConfig.passkey_enabled === false) {
      setError(t("passkeyUnsupported"));
      return;
    }
    if (!email.trim()) {
      setError(t("passkeyUseEmail"));
      return;
    }
    setPasskeyBusy(true);
    try {
      const start = await fetch(apiPath("/api/auth/passkey/start"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!start.ok) {
        setError((await safeError(start)) || t("passkeyLoginFailed"));
        return;
      }
      const challenge = (await start.json()) as PasskeyAuthenticationStart;
      const credential = (await navigator.credentials.get(decodeCredentialRequestOptions(challenge.options))) as PublicKeyCredential | null;
      if (!credential) {
        setError(t("passkeyLoginFailed"));
        return;
      }
      const finish = await fetch(apiPath("/api/auth/passkey/finish"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authentication_id: challenge.authentication_id,
          credential: publicKeyCredentialToJson(credential)
        })
      });
      if (!finish.ok) {
        setError((await safeError(finish)) || t("passkeyLoginFailed"));
        return;
      }
      const data = await finish.json();
      localStorage.setItem(tokenKey, data.token);
      onToken(data.token);
    } catch {
      setError(t("passkeyLoginFailed"));
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <div className="loginHead">
          <h1>humen-mcp</h1>
          <SourceLink />
        </div>
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
          <Check size={18} /> {t("adminSignIn")}
        </button>
        <button className="secondary" type="button" onClick={signInWithPasskey} disabled={passkeyBusy || authConfig.passkey_enabled === false}>
          <KeyRound size={18} /> {t("passkeySignIn")}
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
      {visible.map((channel) => (
        <a className="oauth" key={channel.provider} href={oauthStartUrl(channel.provider)}>
          {channel.provider === "github" ? <Github size={18} /> : <Shield size={18} />}
          {oauthProviderLabel(channel.provider)}
        </a>
      ))}
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

function TopBar({
  user,
  preferences,
  setPreferences,
  isAdmin,
  onSettings,
  onLogout
}: {
  user: User;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  isAdmin: boolean;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const displayName = preferences.displayName.trim() || user.email;
  return (
    <header className="topbar">
      <div className="topbarLead">
        <span className="mode">{isAdmin ? t("administrator") : t("human")}</span>
        <SourceLink />
      </div>
      <div className="userMenu">
        <button
          className="topbarAction"
          title={preferences.theme === "light" ? t("switchDark") : t("switchLight")}
          onClick={() => setPreferences({ ...preferences, theme: preferences.theme === "light" ? "dark" : "light" })}
        >
          {preferences.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{preferences.theme === "light" ? t("light") : t("dark")}</span>
        </button>
        <button
          className="topbarAction langButton"
          title="切换语言 / Switch language"
          onClick={() => setPreferences({ ...preferences, language: preferences.language === "zh" ? "en" : "zh" })}
        >
          <Languages size={18} />
          <span>{preferences.language === "zh" ? "中文" : "English"}</span>
        </button>
        <button className="avatarButton" title={displayName} onClick={onSettings}>
          <UserCircle size={22} />
          <span style={{ background: preferences.avatarColor }}>{avatarText(user, preferences)}</span>
          <small>
            <strong>{t("user")}</strong>
            {displayName}
          </small>
        </button>
        <button className="iconButton" title={t("settings")} onClick={onSettings}>
          <Settings size={18} />
        </button>
        <button className="iconButton" title={t("logout")} onClick={onLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function SourceLink() {
  return (
    <a className="sourceLink" href={sourceUrl} target="_blank" rel="noreferrer">
      <Github size={18} />
      <span>{t("sourceCode")}</span>
    </a>
  );
}

function TaskPanel({ request, token, now, afterSubmit }: { request: HumanRequest; token: string; now: number; afterSubmit: () => void }) {
  const [answer, setAnswer] = useState(defaultRequestAnswer(request));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const imageSrc = imageSource(request);

  useEffect(() => {
    setAnswer(defaultRequestAnswer(request));
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

      {imageSrc && (
        <figure className="imagePreview">
          <img src={imageSrc} alt="" />
        </figure>
      )}

      {request.steps.length > 0 && (
        <ol className="steps">
          {request.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {request.kind === "judgment" ? (
        <div className="judgmentChoices">
          <button className={`judgmentButton yes ${answer === "yes" ? "chosen" : ""}`} onClick={() => setAnswer("yes")}>
            <Check size={22} />
            <span>{currentLanguage() === "zh" ? "是" : "Yes"}</span>
          </button>
          <button className={`judgmentButton no ${answer === "no" ? "chosen" : ""}`} onClick={() => setAnswer("no")}>
            <X size={22} />
            <span>{currentLanguage() === "zh" ? "否" : "No"}</span>
          </button>
        </div>
      ) : request.choices.length > 0 ? (
        <div className="choices">
          {request.choices.map((choice) => (
            <button key={choice} className={answer === choice ? "chosen" : ""} onClick={() => setAnswer(choice)}>
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={t("answer")} />
      )}

      <textarea className="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("note")} />

      <footer>
        <span>{request.timeout_seconds}s {t("timeout")}</span>
        <button className="primary" onClick={submit} disabled={submitting || !answer.trim() || now >= request.expires_at}>
          <Send size={18} /> {t("sendAnswer")}
        </button>
      </footer>
    </article>
  );
}

function SentView({ sent }: { sent: AnsweredRequest[] }) {
  return (
    <section className="page">
      <div className="pageTitle">
        <h2>{t("sent")}</h2>
      </div>
      <div className="gridList">
        {sent.map((entry) => (
          <article className="listCard" key={entry.request.id}>
            <div className="cardHead">
              <Send size={18} />
              <strong>{entry.request.title}</strong>
            </div>
            <p>{entry.answer.answer}</p>
            {entry.answer.note && <small>{entry.answer.note}</small>}
            <div className="metaRow">
              <span>{entry.answer.answered_by}</span>
              <span>{formatTime(entry.answer.answered_at)}</span>
              {entry.answered_late && <span>{t("expired")}</span>}
            </div>
            <div className="tagRow">{entry.request.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </article>
        ))}
        {sent.length === 0 && <Blank text={t("sentEmpty")} />}
      </div>
    </section>
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
        <h2>{t("trash")}</h2>
        <button className="secondary" onClick={clear} disabled={trash.length === 0}>
          <Trash2 size={17} /> {t("clear")}
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
        {trash.length === 0 && <Blank text={t("noExpired")} />}
      </div>
    </section>
  );
}

type TaskFilter = "active" | "all" | AgentTaskStatus;

function AgentTasksView({
  tasks,
  token,
  setTasks
}: {
  tasks: AgentTask[];
  token: string;
  setTasks: (tasks: AgentTask[]) => void;
}) {
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "active") return task.status === "open" || task.status === "in_progress";
    return task.status === filter;
  });

  async function refresh() {
    await refreshTasks(token, setTasks);
  }

  async function setStatus(task: AgentTask, status: AgentTaskStatus) {
    setBusyId(task.id);
    try {
      const response = await fetch(apiPath(`/api/tasks/${task.id}/status`), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: JSON.stringify({
          status,
          note: notes[task.id] ?? task.human_note ?? null
        })
      });
      const updated = await safeJson<AgentTask>(response);
      if (updated) setTasks(upsertAgentTask(tasks, updated));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>{t("tasks")}</h2>
          <p>Agent 创建的任务会出现在这里。</p>
        </div>
        <button className="secondary" onClick={refresh}>
          <RefreshCw size={17} /> {t("refresh")}
        </button>
      </div>

      <div className="segmented taskFilters">
        {(["active", "open", "in_progress", "done", "archived", "all"] as TaskFilter[]).map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {taskFilterLabel(item)}
          </button>
        ))}
      </div>

      <div className="gridList taskGrid">
        {visible.map((task) => (
          <article className="listCard taskCard" key={task.id}>
            <div className="cardHead">
              <ListChecks size={18} />
              <strong>{task.title}</strong>
              <span className={`statusPill taskStatus-${task.status}`}>{taskStatusLabel(task.status)}</span>
            </div>
            {task.description && <p>{task.description}</p>}
            {task.steps.length > 0 && (
              <ol className="compactSteps">
                {task.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            <div className="metaRow">
              <span>{formatTime(task.created_at)}</span>
              {task.due_at && <span>{currentLanguage() === "zh" ? "截止" : "Due"} {formatTime(task.due_at)}</span>}
              {task.completed_at && <span>{currentLanguage() === "zh" ? "完成" : "Done"} {formatTime(task.completed_at)}</span>}
            </div>
            <div className="tagRow">{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <textarea
              className="note compactNote"
              value={notes[task.id] ?? task.human_note ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))}
              placeholder={t("note")}
            />
            <div className="rowActions">
              {task.status !== "in_progress" && task.status !== "done" && task.status !== "archived" && (
                <button className="secondary" disabled={busyId === task.id} onClick={() => setStatus(task, "in_progress")}>
                  <Clock3 size={16} /> {taskStatusLabel("in_progress")}
                </button>
              )}
              {task.status !== "done" && task.status !== "archived" && (
                <button className="primary" disabled={busyId === task.id} onClick={() => setStatus(task, "done")}>
                  <Check size={16} /> {taskStatusLabel("done")}
                </button>
              )}
              {task.status === "done" && (
                <button className="secondary" disabled={busyId === task.id} onClick={() => setStatus(task, "open")}>
                  <RefreshCw size={16} /> {taskStatusLabel("open")}
                </button>
              )}
              {task.status !== "archived" && (
                <button className="secondary" disabled={busyId === task.id} onClick={() => setStatus(task, "archived")}>
                  <Trash2 size={16} /> {taskStatusLabel("archived")}
                </button>
              )}
            </div>
          </article>
        ))}
        {visible.length === 0 && <Blank text={t("noTasks")} />}
      </div>
    </section>
  );
}

function DirectoryView({
  query,
  setQuery,
  users,
  tags,
  token,
  currentUser,
  onChanged
}: {
  query: string;
  setQuery: (query: string) => void;
  users: UserProfile[];
  tags: TagStat[];
  token: string;
  currentUser: string;
  onChanged: () => void;
}) {
  const [introCode, setIntroCode] = useState("");
  const [friends, setFriends] = useState<FriendBundle>({ friends: [], incoming: [], outgoing: [] });
  const [status, setStatus] = useState("");

  useEffect(() => {
    refreshFriends();
  }, [token]);

  async function refreshFriends() {
    const response = await fetch(apiPath("/api/friends"), { headers: authHeaders(token) });
    const data = await safeJson<FriendBundle>(response);
    if (data) setFriends(data);
  }

  async function createFriendRequest(body: { email?: string; friend_code?: string; intro_code?: string }) {
    setStatus("");
    const response = await fetch(apiPath("/api/friends"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || "Request failed");
      return;
    }
    setIntroCode("");
    await refreshFriends();
    onChanged();
  }

  async function addByIntroCode(event: FormEvent) {
    event.preventDefault();
    const code = introCode.trim();
    if (!code) return;
    await createFriendRequest({ friend_code: code });
  }

  async function acceptFriend(email: string) {
    await fetch(apiPath(`/api/friends/${encodeURIComponent(email)}/accept`), {
      method: "POST",
      headers: authHeaders(token)
    });
    await refreshFriends();
    onChanged();
  }

  async function removeFriend(email: string) {
    await fetch(apiPath(`/api/friends/${encodeURIComponent(email)}/remove`), {
      method: "POST",
      headers: authHeaders(token)
    });
    await refreshFriends();
    onChanged();
  }

  return (
    <section className="page">
      <div className="pageTitle">
        <h2>{t("humans")}</h2>
        <label className="searchBox">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchProfile")} />
        </label>
      </div>
      <div className="tagStrip">
        {tags.slice(0, 10).map((tag) => (
          <button key={tag.tag} onClick={() => setQuery(tag.tag)}>
            {tag.tag} <span>{tag.count}</span>
          </button>
        ))}
      </div>
      <form className="introAddRow" onSubmit={addByIntroCode}>
        <label>
          <span>{t("introCode")}</span>
          <input value={introCode} onChange={(event) => setIntroCode(event.target.value)} placeholder="hm-xxxxxxxx" />
        </label>
        <button className="secondary" disabled={!introCode.trim()}>
          <UserPlus size={16} /> {t("addByIntroCode")}
        </button>
      </form>
      {status && <div className="notice warning">{status}</div>}
      {(friends.incoming.length > 0 || friends.outgoing.length > 0 || friends.friends.length > 0) && (
        <section className="relationPanel">
          {friends.incoming.length > 0 && (
            <RelationStrip title={t("incomingRequests")} users={friends.incoming} action={(profile) => (
              <button className="secondary small" onClick={() => acceptFriend(profile.email)}>
                <Check size={15} /> {t("acceptFriend")}
              </button>
            )} />
          )}
          {friends.outgoing.length > 0 && (
            <RelationStrip title={t("outgoingRequests")} users={friends.outgoing} action={() => (
              <span className="statusPill">{t("friendPending")}</span>
            )} />
          )}
          {friends.friends.length > 0 && (
            <RelationStrip title={t("friends")} users={friends.friends} action={(profile) => (
              <button className="secondary small" onClick={() => removeFriend(profile.email)}>
                <Trash2 size={15} /> {t("removeFriend")}
              </button>
            )} />
          )}
        </section>
      )}
      <div className="gridList">
        {users.map((profile) => (
          <UserCard
            key={profile.email}
            profile={profile}
            currentUser={currentUser}
            onAdd={(email) => createFriendRequest({ email })}
            onAccept={acceptFriend}
            onRemove={removeFriend}
          />
        ))}
        {users.length === 0 && <Blank text={t("noHumans")} />}
      </div>
    </section>
  );
}

function RelationStrip({
  title,
  users,
  action
}: {
  title: string;
  users: UserProfile[];
  action: (profile: UserProfile) => React.ReactNode;
}) {
  return (
    <div className="relationStrip">
      <strong>{title}</strong>
      <div>
        {users.map((profile) => (
          <article key={profile.email} className="relationItem">
            <span>{profile.email}</span>
            {action(profile)}
          </article>
        ))}
      </div>
    </div>
  );
}

function TagsView({ tags, setQuery, setView }: { tags: TagStat[]; setQuery: (query: string) => void; setView: (view: View) => void }) {
  return (
    <section className="page">
      <div className="pageTitle">
        <h2>{t("tags")}</h2>
      </div>
      <div className="tagCloud">
        {tags.map((tag) => (
          <button key={tag.tag} onClick={() => { setQuery(tag.tag); setView("directory"); }}>
            {tag.tag}
            <span>{tag.count}</span>
          </button>
        ))}
        {tags.length === 0 && <Blank text={t("noTags")} />}
      </div>
    </section>
  );
}

function AgentView({
  token,
  isAdmin,
  settings,
  setSettings
}: {
  token: string;
  isAdmin: boolean;
  settings: AdminSettings | null;
  setSettings: (settings: AdminSettings | null) => void;
}) {
  const [access, setAccess] = useState<AgentAccess | null>(null);
  const [userSecretDraft, setUserSecretDraft] = useState("");
  const [prefixDraft, setPrefixDraft] = useState("");
  const [allowDirectoryDraft, setAllowDirectoryDraft] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    refresh();
  }, [token]);

  useEffect(() => {
    setPrefixDraft(settings?.agent_secret_prefix ?? "");
    setAllowDirectoryDraft(Boolean(settings?.allow_agent_directory));
  }, [settings?.agent_secret_prefix, settings?.allow_agent_directory]);

  useEffect(() => {
    if (access) setUserSecretDraft(access.user_agent_secret ?? "");
  }, [access?.user_agent_secret]);

  async function refresh() {
    const data = await fetch(apiPath("/api/agent/access"), { headers: authHeaders(token) }).then((response) => safeJson<AgentAccess>(response));
    if (data) setAccess(data);
  }

  async function saveUserSecret() {
    setStatus(t("savingAgent"));
    const response = await fetch(apiPath("/api/agent/secret"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ agent_secret: userSecretDraft.trim() || null })
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || "Save failed");
      return;
    }
    setAccess(await response.json());
    setStatus(t("agentSaved"));
  }

  async function saveAdminAgentSettings() {
    if (!settings) return;
    if (allowDirectoryDraft && !riskAccepted && !settings.allow_agent_directory) {
      setStatus(t("allowAgentDirectoryRisk"));
      return;
    }
    setStatus(t("savingAgent"));
    const next = {
      ...settings,
      agent_secret_prefix: prefixDraft.trim() || null,
      allow_agent_directory: allowDirectoryDraft
    };
    const response = await fetch(apiPath("/api/admin/settings"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(next)
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || "Save failed");
      return;
    }
    setSettings(await response.json());
    await refresh();
    setStatus(t("agentSaved"));
  }

  const mcpUrl = normalizeMcpUrl(access?.mcp_url ?? defaultMcpUrl());
  const accessKey = access?.agent_secret ?? "";
  const headerLine = " -H '" + "x-humen-agent-secret" + ": " + accessKey + "'";
  const installPrompt = agentInstallPrompt(mcpUrl, accessKey);
  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>{t("agentTitle")}</h2>
          <p>{t("agentSubtitle")}</p>
        </div>
        <button className="secondary" onClick={refresh}>
          <RefreshCw size={17} /> {t("update")}
        </button>
      </div>

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <Shield size={18} />
            <div>
              <h3>MCP Endpoint</h3>
              <p>{t("secretMcp")}</p>
            </div>
          </div>
        </div>
        <label className="copyField">
          <span>URL</span>
          <input value={mcpUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
        <label className="copyField">
          <span>Agent Secret</span>
          <input value={accessKey} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
        <label className="copyField">
          <span>{t("introCode")}</span>
          <input value={access?.friend_code ?? access?.intro_code ?? ""} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <UserCircle size={18} />
            <div>
              <h3>{t("personalAgentSecret")}</h3>
              <p>{t("agentSecretHelp")}</p>
            </div>
          </div>
        </div>
        <label className="copyField">
          <span>{t("adminAgentSecret")}</span>
          <input value={access?.agent_secret_prefix ?? ""} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
        <div className="agentSecretRow">
          <input type="password" value={userSecretDraft} onChange={(event) => setUserSecretDraft(event.target.value)} placeholder="Personal secret suffix" />
          <button className="secondary" onClick={() => setUserSecretDraft(randomSecret().slice(0, 32))}>
            <RefreshCw size={17} /> {t("random")}
          </button>
          <button className="primary" onClick={saveUserSecret}>
            <Check size={17} /> {t("saveSecret")}
          </button>
        </div>
        {status && <div className={status.endsWith(".") ? "notice" : "notice warning"}>{status}</div>}
      </section>

      {isAdmin && settings && (
        <section className="panel">
          <div className="panelHead">
            <div className="panelTitle">
              <Settings size={18} />
              <div>
                <h3>{t("adminAgentSecret")}</h3>
                <p>{t("agentSecretHelp")}</p>
              </div>
            </div>
          </div>
          <div className="agentSecretRow">
            <input type="password" value={prefixDraft} onChange={(event) => setPrefixDraft(event.target.value)} placeholder="Global secret prefix" />
            <button className="secondary" onClick={() => setPrefixDraft(`humen-${randomSecret().slice(0, 18)}-`)}>
              <RefreshCw size={17} /> {t("random")}
            </button>
            <button className="primary" onClick={saveAdminAgentSettings}>
              <Check size={17} /> {t("saveSecret")}
            </button>
          </div>
          <label className="toggleRow">
            <span>{t("allowAgentDirectory")}</span>
            <input type="checkbox" checked={allowDirectoryDraft} onChange={(event) => setAllowDirectoryDraft(event.target.checked)} />
          </label>
          {allowDirectoryDraft && (
            <label className="toggleRow riskToggle">
              <span>{t("allowAgentDirectoryRisk")}</span>
              <input type="checkbox" checked={riskAccepted || settings.allow_agent_directory} onChange={(event) => setRiskAccepted(event.target.checked)} />
            </label>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <MessageSquareText size={18} />
            <div>
              <h3>{t("configExamples")}</h3>
              <p>{t("copyInstallPromptHelp")}</p>
            </div>
          </div>
          <button className="primary" onClick={() => copyToClipboard(installPrompt, setCopyStatus)}>
            <Check size={17} /> {t("copyInstallPrompt")}
          </button>
        </div>
        {copyStatus && <div className="inlineStatus">{copyStatus}</div>}
        <div className="guideBody">
          <section>
            <h4>{t("installPrompt")}</h4>
            <pre>{installPrompt}</pre>
          </section>
          <section>
            <h4>通用 MCP JSON（仅用于客户端导入或设置页）</h4>
            <pre>{`{
  "mcpServers": {
    "humen": {
      "url": "${mcpUrl}",
      "headers": {
        "x-humen-agent-secret": "${accessKey}"
      }
    }
  }
}`}</pre>
          </section>
          <section>
            <h4>curl 测试</h4>
            <pre>{`curl '${mcpUrl}' \\
  -H 'content-type: application/json' \\
 ${headerLine} \\
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</pre>
          </section>
          <section>
            <h4>Codex / Claude / 其他 Agent 客户端</h4>
            <ol>
              <li>优先使用 Codex CLI、Claude CLI 或对应客户端自带的 MCP 添加命令 / 设置页。</li>
              <li>新增一个名为 <code>humen</code> 的 remote/http MCP server。</li>
              <li>URL 填上面的 MCP Endpoint。</li>
              <li>headers 里加入 <code>x-humen-agent-secret</code>，值为上面的完整 Agent Secret。</li>
              <li>如果当前是 CLI 工具，请用命令行添加；不要直接编辑配置文件。</li>
              <li>保存后重启 Agent，执行 tools/list 确认能看到 ask_humen 和 create_humen_task。</li>
            </ol>
          </section>
        </div>
      </section>
    </section>
  );
}

function WebhookView({
  token,
  settings,
  setSettings
}: {
  token: string;
  settings: AdminSettings;
  setSettings: (settings: AdminSettings | null) => void;
}) {
  const [drafts, setDrafts] = useState<WebhookConfig[]>(() => settings.webhooks ?? []);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(settings.webhooks ?? []);
  }, [settings.webhooks]);

  useEffect(() => {
    const waitingIds = drafts
      .filter((webhook) => webhook.kind === "wechat")
      .filter((webhook) => webhook.weixin_qrcode_url && !webhook.weixin_bot_token)
      .filter((webhook) => ["wait", "waiting", "scaned", "scanned"].includes((webhook.weixin_status ?? "wait").toLowerCase()))
      .map((webhook) => webhook.id);
    if (waitingIds.length === 0) return;
    const handle = window.setInterval(() => {
      waitingIds.forEach((id) => void refreshWeixinStatus(id, true));
    }, 2500);
    return () => window.clearInterval(handle);
  }, [drafts, token]);

  function addWebhook(kind: WebhookConfig["kind"] = "generic") {
    setDrafts((current) => [
      ...current,
      {
        id: randomId(),
        name: "",
        url: "",
        enabled: false,
        secret: "",
        kind,
        help_prompt: defaultWebhookHelpPrompt
      }
    ]);
  }

  function patchWebhook(index: number, patch: Partial<WebhookConfig>) {
    setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function replaceWebhook(updated: WebhookConfig) {
    setDrafts((current) => {
      const next = current.map((item) => (item.id === updated.id ? updated : item));
      setSettings({ ...settings, webhooks: next });
      return next;
    });
  }

  async function saveDrafts(nextDrafts = drafts, savedMessage = "已保存。") {
    setStatus("正在保存 webhooks...");
    const response = await fetch(apiPath("/api/admin/webhooks"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ webhooks: nextDrafts })
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || "保存失败");
      return null;
    }
    const saved = (await response.json()) as WebhookConfig[];
    setDrafts(saved);
    setSettings({ ...settings, webhooks: saved });
    setStatus(savedMessage);
    return saved;
  }

  async function save() {
    await saveDrafts();
  }

  async function startWeixinLogin(id: string) {
    setBusyId(id);
    try {
      const saved = await saveDrafts(drafts, "已保存，正在生成二维码...");
      if (!saved) return;
      const response = await fetch(apiPath(`/api/admin/webhooks/${id}/weixin/login/start`), {
        method: "POST",
        headers: authHeaders(token)
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || "生成二维码失败");
        return;
      }
      replaceWebhook((await response.json()) as WebhookConfig);
      setStatus("请扫描二维码登录。");
    } finally {
      setBusyId(null);
    }
  }

  async function refreshWeixinStatus(id: string, silent = false) {
    if (!silent) setBusyId(id);
    try {
      const response = await fetch(apiPath(`/api/admin/webhooks/${id}/weixin/login/status`), {
        headers: authHeaders(token)
      });
      if (!response.ok) {
        if (!silent) setStatus((await safeError(response)) || "刷新登录状态失败");
        return;
      }
      const updated = (await response.json()) as WebhookConfig;
      replaceWebhook(updated);
      if (!silent) setStatus(updated.weixin_status_message ?? "已刷新登录状态。");
    } finally {
      if (!silent) setBusyId(null);
    }
  }

  async function logoutWeixin(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(apiPath(`/api/admin/webhooks/${id}/weixin/logout`), {
        method: "POST",
        headers: authHeaders(token)
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || "退出登录失败");
        return;
      }
      replaceWebhook((await response.json()) as WebhookConfig);
      setStatus("已退出微信扫码登录。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>Webhooks</h2>
          <p>收到 MCP 消息或微信扫码登录消息时触发；微信消息会同步进入收件箱。</p>
        </div>
        <div className="rowActions">
          <button className="secondary" onClick={() => addWebhook("wechat")}>
            <Plus size={17} /> 微信扫码
          </button>
          <button className="secondary" onClick={() => addWebhook("generic")}>
            <Plus size={17} /> 新增 webhook
          </button>
          <button className="primary" onClick={save}>
            <Check size={17} /> 保存
          </button>
        </div>
      </div>

      {status && <div className={status === "已保存。" ? "notice" : "notice warning"}>{status}</div>}

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <Webhook size={18} />
            <div>
              <h3>触发规则</h3>
              <p>Generic：ask_humen 创建消息时 POST 到目标 URL；微信：扫码登录后接收消息并可选转发到目标 URL。</p>
            </div>
          </div>
        </div>
        <pre>{`POST payload:
{
  "event": "request_created" | "message_received",
  "source": "mcp" | "wechat",
  "request": { ...HumanRequest },
  "raw": { ...incomingMessage }
}`}</pre>
      </section>

      <div className="webhookList">
        {drafts.map((webhook, index) => {
          return (
            <article className={`oauthCard webhookCard ${webhook.kind === "wechat" ? "wechatWebhookCard" : ""}`} key={webhook.id}>
              <div className="oauthCardGrid webhookGrid">
                <label>
                  <span>名称</span>
                  <input value={webhook.name} onChange={(event) => patchWebhook(index, { name: event.target.value })} />
                </label>
                <label>
                  <span>类型</span>
                  <select value={webhook.kind} onChange={(event) => patchWebhook(index, { kind: event.target.value })}>
                    <option value="generic">Generic webhook</option>
                    <option value="wechat">个人微信 IM（扫码登录）</option>
                  </select>
                </label>
                <label>
                  <span>目标 URL（可选）</span>
                  <input value={webhook.url} onChange={(event) => patchWebhook(index, { url: event.target.value })} placeholder="https://example.com/webhook" />
                </label>
                <label className={webhook.kind === "wechat" ? "webhookSecretField hidden" : "webhookSecretField"}>
                  <span>Secret</span>
                  <input type="password" value={webhook.secret ?? ""} onChange={(event) => patchWebhook(index, { secret: event.target.value })} placeholder="用于签名" />
                </label>
              </div>
              <label className="webhookHelpField">
                <span>帮助信息提示词</span>
                <small>这段文本会通过 webhook 发送给 IM 平台，作为人类回复 Agent 请求时看到的提示信息。默认说明比较完整并包含处理网址；熟悉流程后可以自由精简，留空表示不发送帮助信息。可用占位符：{"{url}"}、{"{request_id}"}、{"{short_id}"}、{"{title}"}。</small>
                <textarea
                  value={webhook.help_prompt ?? ""}
                  onChange={(event) => patchWebhook(index, { help_prompt: event.target.value })}
                  placeholder="留空则不发送帮助信息"
                />
              </label>

              {webhook.kind === "wechat" && (
                <section className="weixinLoginBox">
                  <div className="weixinLoginHead">
                    <div>
                      <QrCode size={18} />
                      <strong>微信扫码登录</strong>
                    </div>
                    <span className={`statusPill ${webhook.weixin_bot_token ? "onlineStatus" : ""}`}>
                      {weixinStatusLabel(webhook)}
                    </span>
                  </div>
                  <div className="weixinLoginBody">
                    {webhook.weixin_qrcode_url ? (
                      <img className="weixinQr" src={webhook.weixin_qrcode_url} alt="微信扫码登录二维码" />
                    ) : (
                      <div className="weixinQr placeholder">
                        <QrCode size={44} />
                      </div>
                    )}
                    <div className="weixinLoginMeta">
                      <p>{webhook.weixin_status_message || (webhook.weixin_bot_token ? "已登录" : "未登录")}</p>
                      {webhook.weixin_account_id && <code>{webhook.weixin_account_id}</code>}
                      {webhook.weixin_last_seen_at && <small>最近收到消息：{formatTime(webhook.weixin_last_seen_at)}</small>}
                      {webhook.weixin_last_error && <small className="error">{webhook.weixin_last_error}</small>}
                    </div>
                  </div>
                </section>
              )}

              <div className="oauthActions webhookActions">
                <label className="toggleRow compact">
                  <span>启用</span>
                  <input type="checkbox" checked={webhook.enabled} onChange={(event) => patchWebhook(index, { enabled: event.target.checked })} />
                </label>
                {webhook.kind !== "wechat" && (
                  <button className="secondary" onClick={() => patchWebhook(index, { secret: randomSecret().slice(0, 32) })}>
                    <RefreshCw size={16} /> 生成 Secret
                  </button>
                )}
                {webhook.kind === "wechat" && (
                  <>
                    <button className="secondary" disabled={busyId === webhook.id} onClick={() => startWeixinLogin(webhook.id)}>
                      <QrCode size={16} /> {webhook.weixin_bot_token ? "重新扫码" : "扫码登录"}
                    </button>
                    {webhook.weixin_qrcode_url && !webhook.weixin_bot_token && (
                      <button className="secondary" disabled={busyId === webhook.id} onClick={() => refreshWeixinStatus(webhook.id)}>
                        <RefreshCw size={16} /> 刷新状态
                      </button>
                    )}
                    {webhook.weixin_bot_token && (
                      <button className="secondary" disabled={busyId === webhook.id} onClick={() => logoutWeixin(webhook.id)}>
                        <LogOut size={16} /> 退出登录
                      </button>
                    )}
                  </>
                )}
                <button className="secondary" onClick={() => setDrafts((current) => current.filter((item) => item.id !== webhook.id))}>
                  <Trash2 size={16} /> 移除
                </button>
              </div>
            </article>
          );
        })}
        {drafts.length === 0 && <Blank text="点击左上角或左下角的加号新增 webhook" />}
      </div>
    </section>
  );
}

function weixinStatusLabel(webhook: WebhookConfig) {
  if (webhook.weixin_bot_token) return "已登录";
  const status = (webhook.weixin_status ?? "").toLowerCase();
  if (status === "scaned" || status === "scanned") return "待确认";
  if (status === "wait" || status === "waiting") return "待扫码";
  if (status === "expired") return "已过期";
  if (status === "logged_out") return "未登录";
  return status || "未登录";
}

function AdminView({
  token,
  user,
  preferences,
  setPreferences,
  users,
  settings,
  setUsers,
  setSettings,
  onRefresh,
  refreshing
}: {
  token: string;
  user: User;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  users: UserProfile[];
  settings: AdminSettings;
  setUsers: (users: UserProfile[]) => void;
  setSettings: (settings: AdminSettings) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [oauthProvider, setOauthProvider] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [oauthStatus, setOauthStatus] = useState<Record<string, string>>({});

  async function saveSettings(next: AdminSettings) {
    setSettingsStatus(t("saving"));
    setSettings(next);
    try {
      const response = await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!response.ok) {
        setSettingsStatus((await safeError(response)) || "Save failed");
        return false;
      }
      setSettings(mergeOAuthSecrets(await response.json(), next));
      setSettingsStatus(t("saved"));
      return true;
    } catch (err) {
      setSettingsStatus(err instanceof Error ? err.message : "Save failed");
      return false;
    }
  }

  async function saveOAuthSettings(next: AdminSettings, provider: string) {
    const key = normalizeOAuthProvider(provider);
    setOauthStatus((current) => ({ ...current, [key]: t("saving") }));
    const ok = await saveSettings(next);
    setOauthStatus((current) => ({ ...current, [key]: ok ? t("saved") : t("saveFailed") }));
  }

  function addOAuthChannel(event: FormEvent) {
    event.preventDefault();
    const provider = normalizeOAuthProvider(oauthProvider);
    if (!provider) return;
    upsertOAuthChannel(provider, oauthClientId.trim(), false);
    setOauthProvider("");
    setOauthClientId("");
  }

  function upsertOAuthChannel(provider: string, clientId = "", enabled = false) {
    const normalized = normalizeOAuthProvider(provider);
    if (!normalized) return;
    const nextChannels = settings.oauth_channels.filter((channel) => channel.provider !== normalized);
    nextChannels.push({ provider: normalized, enabled, client_id: clientId, client_secret: "" });
    saveSettings({ ...settings, oauth_channels: nextChannels });
  }

  return (
    <section className="page adminPage">
      <div className="pageTitle">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("adminSubtitle")}</p>
        </div>
        <button className="secondary" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? "spin" : ""} /> {t("updatePanel")}
        </button>
      </div>

      <PersonalizationPanel user={user} preferences={preferences} setPreferences={setPreferences} />
      <ProfilePanel token={token} />
      {settingsStatus && <div className={settingsStatus === t("saved") ? "notice" : "notice warning"}>{settingsStatus}</div>}

      <section className="panel">
        <div className="panelHead">
          <Shield size={18} />
          <h3>{t("registration")}</h3>
        </div>
        <label className="toggleRow">
          <span>{t("allowNewUsers")}</span>
          <input
            type="checkbox"
            checked={settings.allow_registration}
            onChange={(event) => saveSettings({ ...settings, allow_registration: event.target.checked })}
          />
        </label>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <Github size={18} />
            <div>
              <h3>{t("oauthChannels")}</h3>
              <p>{t("oauthHelp")}</p>
            </div>
          </div>
          <button className="secondary small" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> {t("update")}
          </button>
        </div>

        <div className="oauthPresetRow">
          {oauthPresets.map((preset) => {
            const exists = settings.oauth_channels.some((channel) => channel.provider === preset.provider);
            return (
              <button
                className="secondary small"
                key={preset.provider}
                onClick={() => upsertOAuthChannel(preset.provider)}
                disabled={exists}
              >
                <UserPlus size={15} /> {exists ? `${preset.label} added` : `Add ${preset.label}`}
              </button>
            );
          })}
        </div>

        <div className="oauthCallbackHint">
          <strong>{t("callbackExample")}</strong>
          <code>{oauthCallbackUrl("github")}</code>
        </div>

        <OAuthSetupGuide channels={settings.oauth_channels} />

        {settings.oauth_channels.map((channel, index) => (
          <div className="oauthCard" key={`${channel.provider}-${index}`}>
            <div className="oauthCardGrid">
              <label>
                <span>Provider</span>
                <input value={oauthProviderLabel(channel.provider)} readOnly />
              </label>
              <label>
                <span>Client ID</span>
                <input
                  value={channel.client_id}
                  onChange={(event) => {
                    const next = [...settings.oauth_channels];
                    next[index] = { ...channel, client_id: event.target.value };
                    setSettings({ ...settings, oauth_channels: next });
                  }}
                  placeholder="OAuth Client ID"
                />
              </label>
              <label>
                <span>Client Secret</span>
                <input
                  type="password"
                  value={channel.client_secret ?? ""}
                  onChange={(event) => {
                    const next = [...settings.oauth_channels];
                    next[index] = { ...channel, client_secret: event.target.value };
                    setSettings({ ...settings, oauth_channels: next });
                  }}
                  placeholder="OAuth Client Secret"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Callback / Redirect URI</span>
                <input
                  value={oauthCallbackUrl(channel.provider)}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            </div>
            <div className="oauthActions">
              <label className="toggleRow compact">
                <span>{t("enabled")}</span>
              <input
                  type="checkbox"
                  checked={channel.enabled}
                  onChange={(event) => {
                    const next = [...settings.oauth_channels];
                    next[index] = { ...channel, enabled: event.target.checked };
                    saveOAuthSettings({ ...settings, oauth_channels: next }, channel.provider);
                  }}
                />
              </label>
              <button
                className="secondary"
                onClick={() => saveOAuthSettings({ ...settings, oauth_channels: settings.oauth_channels }, channel.provider)}
              >
                <Check size={16} /> {t("save")}
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
                <Trash2 size={16} /> {t("remove")}
              </button>
            </div>
            {oauthStatus[channel.provider] && <div className="inlineStatus">{oauthStatus[channel.provider]}</div>}
          </div>
        ))}
        <form className="oauthAddRow" onSubmit={addOAuthChannel}>
          <input value={oauthProvider} onChange={(event) => setOauthProvider(event.target.value)} placeholder="provider, e.g. custom-sso" />
          <input value={oauthClientId} onChange={(event) => setOauthClientId(event.target.value)} placeholder="client id" />
          <button className="secondary" disabled={!oauthProvider.trim()}>
            <UserPlus size={16} /> {t("addChannel")}
          </button>
        </form>
      </section>


      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <Users size={18} />
            <h3>{t("users")}</h3>
          </div>
          <button className="secondary small" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> {t("update")}
          </button>
        </div>
        <div className="userTable">
          {users.map((profile) => (
            <AdminUserRow key={`${profile.provider}:${profile.email}`} profile={profile} token={token} afterChange={() => refreshAdmin(token, () => {}, setUsers, setSettings)} />
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
  const isAdmin = profile.provider === "password";

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
          <Check size={16} /> {t("save")} profile
        </button>
      </div>
      <div className="rowActions">
        <label className="banUntil">
          <span>{t("banUntil")}</span>
          <input type="datetime-local" value={banUntil} onChange={(event) => setBanUntil(event.target.value)} disabled={isAdmin} />
        </label>
        <button className="secondary" onClick={applyCustomBan} disabled={!banUntil || isAdmin}>
          <Ban size={16} /> {t("set")}
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: Math.floor(Date.now() / 1000) + 3600 })} disabled={isAdmin}>
          <Ban size={16} /> 1h
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: Math.floor(Date.now() / 1000) + 86400 })} disabled={isAdmin}>
          <Ban size={16} /> 24h
        </button>
        <button className="secondary" onClick={() => patch({ ban_expires_at: null })} disabled={isAdmin}>
          <Check size={16} /> {t("unban")}
        </button>
        <button className="secondary" onClick={kick} disabled={isAdmin}>
          <LogOut size={16} /> {t("kick")}
        </button>
      </div>
    </div>
  );
}

function OAuthSetupGuide({ channels }: { channels: OAuthChannelConfig[] }) {
  const configured = channels.length > 0 ? channels : [{ provider: "github", enabled: false, client_id: "" }];
  return (
    <details className="oauthGuide">
      <summary>
        <Shield size={17} />
        {t("oauthGuide")}
      </summary>
      <div className="guideBody">
        <section>
          <h4>{t("commonFlow")}</h4>
          <ol>
            <li>在对应平台创建 OAuth App / Application。</li>
            <li>应用类型选择 Web application / Confidential client；不要选纯前端 SPA。</li>
            <li>把下面的 Callback / Redirect URI 完整复制到平台配置里。</li>
            <li>复制 Client ID 和 Client Secret 到本面板；Secret 会用密码框展示，生产环境仍建议由后端加密保存或环境变量托管。</li>
            <li>保存后先保持 Disabled，确认后端已经支持该 provider 并配置 secret，再启用。</li>
            <li>重启后端或重新加载配置，然后用无痕窗口测试登录。</li>
          </ol>
        </section>

        <section>
          <h4>{t("currentCallbacks")}</h4>
          <div className="callbackList">
            {configured.map((channel) => (
              <label key={channel.provider}>
                <span>{oauthProviderLabel(channel.provider)}</span>
                <input value={oauthCallbackUrl(channel.provider)} readOnly onFocus={(event) => event.currentTarget.select()} />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h4>{t("presetDocs")}</h4>
          <div className="docLinks">
            {oauthPresets.map((preset) => (
              <a key={preset.provider} href={preset.docsUrl} target="_blank" rel="noreferrer">
                {preset.label} OAuth docs
              </a>
            ))}
          </div>
        </section>

        <section>
          <h4>{t("providerNotes")}</h4>
          <ul>
            <li>
              <strong>GitHub：</strong>Homepage URL 填站点根地址，Authorization callback URL 填
              <code>{oauthCallbackUrl("github")}</code>。
            </li>
            <li>
              <strong>Google：</strong>Authorized redirect URIs 必须逐条添加完整回调 URL；测试阶段记得把测试用户加入 OAuth consent screen。
            </li>
            <li>
              <strong>Microsoft：</strong>Redirect URI 选择 Web；多租户/单租户要和你的用户范围一致。
            </li>
            <li>
              <strong>GitLab：</strong>Redirect URI 填完整回调 URL，scope 通常至少需要读取用户身份/邮箱。
            </li>
          </ul>
        </section>

        <section className="guideWarning">
          <h4>{t("importantNotes")}</h4>
          <ul>
            <li>Client Secret 是敏感信息：不要截图外泄；生产环境建议后端加密保存，或使用服务器环境变量/密钥管理器。</li>
            <li>登录入口会跳转到 <code>/api/auth/oauth/&lt;provider&gt;/start</code>，回调为 <code>/api/auth/oauth/&lt;provider&gt;/callback</code>。</li>
            <li>新增非 GitHub 渠道前，后端也必须实现对应 provider 的 start/callback 和 token/userinfo 交换。</li>
            <li>如果站点挂在 <code>/mcp</code> 子路径下，回调 URL 也必须包含 <code>/mcp</code>。</li>
            <li>生产环境必须使用 HTTPS；HTTP 回调通常只适合 localhost 开发。</li>
          </ul>
        </section>
      </div>
    </details>
  );
}

function AccountView({
  token,
  user,
  preferences,
  setPreferences,
  onRefresh,
  refreshing,
  notice
}: {
  token: string;
  user: User;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  onRefresh: () => void;
  refreshing: boolean;
  notice?: string;
}) {
  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("settingsSubtitle")}</p>
        </div>
        <button className="secondary" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? "spin" : ""} /> {t("updatePanel")}
        </button>
      </div>
      {notice && <div className="notice">{notice}</div>}
      <PersonalizationPanel user={user} preferences={preferences} setPreferences={setPreferences} />
      <ProfilePanel token={token} />
      <PasskeyPanel token={token} />
    </section>
  );
}

function PersonalizationPanel({
  user,
  preferences,
  setPreferences
}: {
  user: User;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
}) {
  const update = (patch: Partial<Preferences>) => setPreferences({ ...preferences, ...patch });
  const reset = () => setPreferences(defaultPreferences);
  const displayName = preferences.displayName.trim() || user.email;
  return (
    <section className="panel personalizationPanel">
      <div className="panelHead">
        <div className="panelTitle">
          <div className="avatarCircle large" style={{ background: preferences.avatarColor }}>
            {avatarText(user, preferences)}
          </div>
          <div>
            <h3>{t("personalization")}</h3>
            <p>{displayName} · {user.email} · {user.provider}</p>
          </div>
        </div>
        <button className="secondary small" onClick={reset}>
          <RefreshCw size={15} /> {t("reset")}
        </button>
      </div>

      <div className="settingsGrid">
        <label>
          <span>{t("displayName")}</span>
          <input
            value={preferences.displayName}
            onChange={(event) => update({ displayName: event.target.value })}
            placeholder={user.email}
          />
        </label>
        <label>
          <span>{t("avatarText")}</span>
          <input
            value={preferences.avatarText}
            maxLength={4}
            onChange={(event) => update({ avatarText: event.target.value })}
            placeholder={initials(user.email)}
          />
        </label>
        <label>
          <span>{t("avatarColor")}</span>
          <input
            type="color"
            value={preferences.avatarColor}
            onChange={(event) => update({ avatarColor: event.target.value })}
          />
        </label>
      </div>

      <div className="quickSettings">
        <div className="segmented">
          <button className={preferences.theme === "light" ? "active" : ""} onClick={() => update({ theme: "light" })}>
            <Sun size={16} /> {t("light")}
          </button>
          <button className={preferences.theme === "dark" ? "active" : ""} onClick={() => update({ theme: "dark" })}>
            <Moon size={16} /> {t("dark")}
          </button>
        </div>

        <div className="segmented">
          <button className={preferences.language === "zh" ? "active" : ""} onClick={() => update({ language: "zh" })}>
            <Languages size={16} /> 中文
          </button>
          <button className={preferences.language === "en" ? "active" : ""} onClick={() => update({ language: "en" })}>
            <Languages size={16} /> English
          </button>
        </div>

        <label className="toggleRow compactToggle">
          <span>{t("compact")}</span>
          <input
            type="checkbox"
            checked={preferences.compact}
            onChange={(event) => update({ compact: event.target.checked })}
          />
        </label>
      </div>
    </section>
  );
}

function ProfilePanel({ token }: { token: string }) {
  const [profile, setProfile] = useState(profileTemplate);
  const [tags, setTags] = useState("");
  const [introCode, setIntroCode] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(apiPath("/api/me/profile"), { headers: authHeaders(token) })
      .then((response) => safeJson<UserProfile>(response))
      .then((data) => {
        if (!data) return;
        setProfile(data.profile || profileTemplate);
        setTags(data.tags.join(" "));
        setIntroCode(data.friend_code ?? data.intro_code ?? "");
        setIsPublic(Boolean(data.is_public));
        setOnboardingCompleted(Boolean(data.onboarding_completed));
      })
      .catch(() => {});
  }, [token]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus(t("savingProfile"));
    const response = await fetch(apiPath("/api/me/profile"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({
        profile,
        tags: splitTags(tags),
        is_public: isPublic,
        onboarding_completed: true
      })
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || t("saveProfileFailed"));
      return;
    }
    const data = await safeJson<UserProfile>(response);
    if (data) {
      setProfile(data.profile || profileTemplate);
      setTags(data.tags.join(" "));
      setIntroCode(data.friend_code ?? data.intro_code ?? "");
      setIsPublic(Boolean(data.is_public));
      setOnboardingCompleted(Boolean(data.onboarding_completed));
    }
    setStatus(t("profileSaved"));
  }

  return (
    <section className="panel">
      <div className="panelHead">
        <div className="panelTitle">
          <UserCircle size={18} />
          <div>
            <h3>{t("publicProfile")}</h3>
            <p>{t("profileHelp")}</p>
          </div>
        </div>
      </div>
      <form className="profileForm" onSubmit={save}>
        {!onboardingCompleted && (
          <section className="onboardingBox">
            <strong>{t("onboardingTitle")}</strong>
            <p>{t("onboardingHelp")}</p>
          </section>
        )}
        <label>
          <span>{t("introCode")}</span>
          <input value={introCode} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
        <label className="toggleRow profileToggle">
          <span>
            {t("publicUser")}
            <small>{t("privateUserHelp")}</small>
          </span>
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
        </label>
        <label>
          <span>{t("profile")}</span>
          <textarea value={profile} onChange={(event) => setProfile(event.target.value)} placeholder={profileTemplate} />
        </label>
        <label>
          <span>标签</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="#review #ops #qa" />
        </label>
        <div className="rowActions">
          <button className="secondary" type="button" onClick={() => setProfile(profileTemplate)}>
            {t("useTemplate")}
          </button>
          <button className="primary" type="submit">
            <Check size={17} /> {t("saveProfile")}
          </button>
        </div>
      </form>
      {status && <div className={status.endsWith(".") ? "notice" : "notice warning"}>{status}</div>}
    </section>
  );
}

function PasskeyPanel({ token }: { token: string }) {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = passkeysSupported();

  useEffect(() => {
    void refreshPasskeys();
  }, [token]);

  async function refreshPasskeys() {
    const response = await fetch(apiPath("/api/passkeys"), { headers: authHeaders(token) });
    const data = await safeJson<PasskeyInfo[]>(response);
    setPasskeys(data ?? []);
  }

  async function addPasskey() {
    setStatus("");
    if (!supported) {
      setStatus(t("passkeyUnsupported"));
      return;
    }
    setBusy(true);
    try {
      const start = await fetch(apiPath("/api/passkeys/register/start"), {
        method: "POST",
        headers: authHeaders(token)
      });
      if (!start.ok) {
        setStatus((await safeError(start)) || t("passkeyRegisterFailed"));
        return;
      }
      const challenge = (await start.json()) as PasskeyRegistrationStart;
      const credential = (await navigator.credentials.create(decodeCredentialCreationOptions(challenge.options))) as PublicKeyCredential | null;
      if (!credential) {
        setStatus(t("passkeyRegisterFailed"));
        return;
      }
      const finish = await fetch(apiPath("/api/passkeys/register/finish"), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: JSON.stringify({
          registration_id: challenge.registration_id,
          name: name.trim() || undefined,
          credential: publicKeyCredentialToJson(credential)
        })
      });
      if (!finish.ok) {
        setStatus((await safeError(finish)) || t("passkeyRegisterFailed"));
        return;
      }
      setPasskeys((await safeJson<PasskeyInfo[]>(finish)) ?? []);
      setName("");
      setStatus(t("passkeyAdded"));
    } catch {
      setStatus(t("passkeyRegisterFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setBusy(true);
    try {
      const response = await fetch(apiPath(`/api/passkeys/${encodeURIComponent(id)}/delete`), {
        method: "POST",
        headers: authHeaders(token)
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || t("saveFailed"));
        return;
      }
      setPasskeys((await safeJson<PasskeyInfo[]>(response)) ?? []);
      setStatus(t("passkeyRemoved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel passkeyPanel">
      <div className="panelHead">
        <div className="panelTitle">
          <KeyRound size={18} />
          <div>
            <h3>{t("passkeys")}</h3>
            <p>{t("passkeyHelp")}</p>
          </div>
        </div>
      </div>

      <div className="passkeyAddRow">
        <label>
          <span>{t("passkeyName")}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="MacBook Touch ID" />
        </label>
        <button className="primary" onClick={addPasskey} disabled={busy || !supported}>
          <KeyRound size={17} /> {t("addPasskey")}
        </button>
      </div>

      {!supported && <div className="notice warning">{t("passkeyUnsupported")}</div>}
      {status && <div className={status.endsWith(".") || status.endsWith("。") ? "notice" : "notice warning"}>{status}</div>}

      <div className="passkeyList">
        {passkeys.map((passkey) => (
          <article className="passkeyItem" key={passkey.id}>
            <KeyRound size={17} />
            <div>
              <strong>{passkey.name}</strong>
              <small>
                {formatTime(passkey.created_at)}
                {passkey.last_used_at ? ` · ${formatTime(passkey.last_used_at)}` : ""}
              </small>
            </div>
            <button className="secondary small" onClick={() => removePasskey(passkey.id)} disabled={busy}>
              <Trash2 size={15} /> {t("removePasskey")}
            </button>
          </article>
        ))}
        {passkeys.length === 0 && <div className="empty compactEmpty">{t("noPasskeys")}</div>}
      </div>
    </section>
  );
}

function UserCard({
  profile,
  currentUser,
  onAdd,
  onAccept,
  onRemove
}: {
  profile: UserProfile;
  currentUser?: string;
  onAdd?: (email: string) => void;
  onAccept?: (email: string) => void;
  onRemove?: (email: string) => void;
}) {
  const banned = profile.ban_expires_at && profile.ban_expires_at > Math.floor(Date.now() / 1000);
  const isSelf = currentUser ? profile.email.toLowerCase() === currentUser.toLowerCase() : false;
  return (
    <article className="userCard">
      <div className="avatarCircle">{initials(profile.email)}</div>
      <div>
        <strong>{profile.email}</strong>
        <p>{profile.profile || t("profileMissing")}</p>
        <div className="metaRow">
          <span className={profile.online ? "status onlineStatus" : "status"}>{profile.online ? t("onlineStatus") : t("offlineStatus")}</span>
          <span>{profile.provider}</span>
          {profile.is_public && <span>{currentLanguage() === "zh" ? "公开" : "Public"}</span>}
          {banned && <span className="dangerText">banned until {formatTime(profile.ban_expires_at!)}</span>}
        </div>
        {(profile.friend_code ?? profile.intro_code) && (
          <div className="introCodeLine">
            <span>{t("introCode")}</span>
            <code>{profile.friend_code ?? profile.intro_code}</code>
          </div>
        )}
        <div className="tagRow">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {!isSelf && (onAdd || onAccept || onRemove) && (
          <div className="userCardActions">
            {profile.is_friend && onRemove && (
              <button className="secondary small" onClick={() => onRemove(profile.email)}>
                <Trash2 size={15} /> {t("removeFriend")}
              </button>
            )}
            {profile.friend_request_received && onAccept && (
              <button className="secondary small" onClick={() => onAccept(profile.email)}>
                <Check size={15} /> {t("acceptFriend")}
              </button>
            )}
            {profile.friend_request_sent && <span className="statusPill">{t("friendPending")}</span>}
            {!profile.is_friend && !profile.friend_request_received && !profile.friend_request_sent && profile.is_public && onAdd && (
              <button className="secondary small" onClick={() => onAdd(profile.email)}>
                <UserPlus size={15} /> {t("addFriend")}
              </button>
            )}
          </div>
        )}
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
  if (kind === "judgment") return <Check size={18} />;
  if (kind === "steps") return <ListChecks size={18} />;
  return <MessageSquareText size={18} />;
}

function defaultRequestAnswer(request: HumanRequest) {
  if (request.kind === "judgment") return "yes";
  return request.choices[0] ?? "";
}

function Countdown({ request, now }: { request: HumanRequest; now: number }) {
  const remaining = Math.max(0, request.expires_at - now);
  if (remaining === 0) return <span className="countdown expired">expired</span>;
  return <span className={remaining <= 30 ? "countdown urgent" : "countdown"}>{formatDuration(remaining)}</span>;
}

function taskStatusLabel(status: AgentTaskStatus) {
  const zh: Record<AgentTaskStatus, string> = {
    open: "待处理",
    in_progress: "处理中",
    done: "已完成",
    archived: "已归档"
  };
  const en: Record<AgentTaskStatus, string> = {
    open: "Open",
    in_progress: "In progress",
    done: "Done",
    archived: "Archived"
  };
  return (currentLanguage() === "en" ? en : zh)[status];
}

function taskFilterLabel(filter: TaskFilter) {
  if (filter === "active") return currentLanguage() === "zh" ? "进行中" : "Active";
  if (filter === "all") return currentLanguage() === "zh" ? "全部" : "All";
  return taskStatusLabel(filter);
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(handle);
  }, []);
  return now;
}

function usePreferences(): [Preferences, (preferences: Preferences) => void] {
  const [preferences, setPreferencesState] = useState<Preferences>(() => {
    try {
      const raw = localStorage.getItem(preferencesKey);
      if (!raw) return defaultPreferences;
      return { ...defaultPreferences, ...JSON.parse(raw) };
    } catch {
      return defaultPreferences;
    }
  });

  function setPreferences(next: Preferences) {
    setPreferencesState(next);
    localStorage.setItem(preferencesKey, JSON.stringify(next));
  }

  return [preferences, setPreferences];
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

function passkeysSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

function decodeCredentialCreationOptions(options: PublicKeyCredentialCreationOptionsJSON): CredentialCreationOptions {
  return {
    publicKey: {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64UrlToBuffer(options.user.id)
      },
      excludeCredentials: options.excludeCredentials?.map(decodeCredentialDescriptor)
    }
  };
}

function decodeCredentialRequestOptions(options: PublicKeyCredentialRequestOptionsJSON): CredentialRequestOptions {
  return {
    publicKey: {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      allowCredentials: options.allowCredentials?.map(decodeCredentialDescriptor)
    }
  };
}

function decodeCredentialDescriptor(descriptor: PublicKeyCredentialDescriptorJSON): PublicKeyCredentialDescriptor {
  return {
    ...descriptor,
    id: base64UrlToBuffer(descriptor.id)
  };
}

function publicKeyCredentialToJson(credential: PublicKeyCredential) {
  const base = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    extensions: credential.getClientExtensionResults()
  };
  const response = credential.response;
  if ("attestationObject" in response) {
    const attestation = response as AuthenticatorAttestationResponse & { getTransports?: () => AuthenticatorTransport[] };
    return {
      ...base,
      response: {
        attestationObject: bufferToBase64Url(attestation.attestationObject),
        clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
        transports: attestation.getTransports?.()
      }
    };
  }
  const assertion = response as AuthenticatorAssertionResponse;
  return {
    ...base,
    response: {
      authenticatorData: bufferToBase64Url(assertion.authenticatorData),
      clientDataJSON: bufferToBase64Url(assertion.clientDataJSON),
      signature: bufferToBase64Url(assertion.signature),
      userHandle: assertion.userHandle ? bufferToBase64Url(assertion.userHandle) : null
    }
  };
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer as ArrayBuffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let raw = "";
  for (const byte of bytes) {
    raw += String.fromCharCode(byte);
  }
  return window.btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function refreshRequests(token: string, setRequests: (requests: HumanRequest[]) => void) {
  const response = await fetch(apiPath("/api/requests"), { headers: authHeaders(token) });
  const data = await safeJson<HumanRequest[]>(response);
  if (data) setRequests(sortRequests(data));
}

async function refreshTasks(token: string, setTasks: (tasks: AgentTask[]) => void) {
  const response = await fetch(apiPath("/api/tasks?include_archived=true"), { headers: authHeaders(token) });
  const data = await safeJson<AgentTask[]>(response);
  setTasks(data ? sortAgentTasks(data) : []);
}

async function refreshSent(token: string, setSent: (sent: AnsweredRequest[]) => void) {
  const response = await fetch(apiPath("/api/sent"), { headers: authHeaders(token) });
  const data = await safeJson<AnsweredRequest[]>(response);
  setSent(data ? sortAnswered(data) : []);
}

async function refreshTrash(token: string, setTrash: (trash: ExpiredRequest[]) => void) {
  const response = await fetch(apiPath("/api/trash"), { headers: authHeaders(token) });
  const data = await safeJson<ExpiredRequest[]>(response);
  setTrash(data ? sortTrash(data) : []);
}

async function refreshUsers(token: string, setOnline: (users: UserProfile[]) => void, setDirectory: (users: UserProfile[]) => void, setTags: (tags: TagStat[]) => void) {
  const [online, users, tags] = await Promise.all([
    fetch(apiPath("/api/users/online"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/users/search"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/tags"), { headers: authHeaders(token) })
  ]);
  const onlineData = await safeJson<UserProfile[]>(online);
  const usersData = await safeJson<UserProfile[]>(users);
  const tagsData = await safeJson<{ tags?: TagStat[] }>(tags);
  setOnline(onlineData ?? []);
  setDirectory(usersData ?? []);
  setTags(tagsData?.tags ?? []);
}

async function refreshDirectory(token: string, setDirectory: (users: UserProfile[]) => void, query: string) {
  const params = query.trim().startsWith("#") ? `?tag=${encodeURIComponent(query.trim())}` : `?q=${encodeURIComponent(query.trim())}`;
  const response = await fetch(apiPath(`/api/users/search${query.trim() ? params : ""}`), { headers: authHeaders(token) });
  setDirectory((await safeJson<UserProfile[]>(response)) ?? []);
}

async function refreshAdmin(token: string, setIsAdmin: (isAdmin: boolean) => void, setUsers: (users: UserProfile[]) => void, setSettings: (settings: AdminSettings) => void) {
  const [users, settings] = await Promise.all([
    fetch(apiPath("/api/admin/users"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/admin/settings"), { headers: authHeaders(token) })
  ]);
  const usersData = await safeJson<UserProfile[]>(users);
  const settingsData = await safeJson<AdminSettings>(settings);
  if (usersData && settingsData) {
    setIsAdmin(true);
    setUsers(usersData);
    setSettings(settingsData);
  } else {
    setIsAdmin(false);
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function safeError(response: Response) {
  const data = await safeJson<{ error?: string }>(response.clone());
  return data?.error ?? `${response.status} ${response.statusText}`;
}

function upsertRequest(current: HumanRequest[], next: HumanRequest) {
  const without = current.filter((request) => request.id !== next.id);
  return sortRequests([...without, next]);
}

function sortRequests(requests: HumanRequest[]) {
  return [...requests].sort((a, b) => a.expires_at - b.expires_at);
}

function sortAgentTasks(tasks: AgentTask[]) {
  const rank: Record<AgentTaskStatus, number> = {
    in_progress: 0,
    open: 1,
    done: 2,
    archived: 3
  };
  return [...tasks].sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    return b.updated_at - a.updated_at;
  });
}

function upsertAgentTask(current: AgentTask[], next: AgentTask) {
  const without = current.filter((task) => task.id !== next.id);
  return sortAgentTasks([next, ...without]);
}

function sortAnswered(sent: AnsweredRequest[]) {
  return [...sent].sort((a, b) => b.answer.answered_at - a.answer.answered_at);
}

function upsertAnswered(current: AnsweredRequest[], next: AnsweredRequest) {
  const without = current.filter((entry) => entry.request.id !== next.request.id);
  return sortAnswered([next, ...without]);
}

function sortTrash(trash: ExpiredRequest[]) {
  return [...trash].sort((a, b) => b.expired_at - a.expired_at);
}

function splitTags(value: string) {
  return value
    .split(/\s+/)
    .map((tag) => tag.trim().replace(/^[,;]+|[,;]+$/g, ""))
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.length > 1 && !reservedTags.has(tag));
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function avatarText(user: User, preferences: Preferences) {
  return (preferences.avatarText.trim() || initials(user.email)).slice(0, 4).toUpperCase();
}

function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function defaultMcpUrl() {
  const path = base.endsWith("/mcp") ? base : `${base}/mcp`;
  return new URL(path || "/mcp", window.location.href).toString();
}

function normalizeMcpUrl(value: string) {
  const url = new URL(value, window.location.href);
  url.pathname = url.pathname.replace(/\/mcp\/mcp$/, "/mcp");
  return url.toString();
}

function agentInstallPrompt(mcpUrl: string, accessKey: string) {
  const headerJson = `,
      "headers": {
        "x-humen-agent-secret": "${accessKey}"
      }`;
  const secretLine = "必须带请求头：" + "x-humen-agent-secret" + ": " + accessKey;
  return `请帮我把 humen-mcp 配置成一个 remote/http MCP server。

请先判断你当前使用的是哪种 Agent 工具或客户端，并使用它自带的 MCP 添加方式：

- 如果是 Codex CLI，请使用 Codex CLI 的 MCP 添加命令（不确定参数时先运行 codex mcp --help / codex mcp add --help）。
- 如果是 Claude Code / Claude CLI，请使用 Claude CLI 的 MCP 添加命令（不确定参数时先运行 claude mcp --help / claude mcp add --help）。
- 如果是其他编程 CLI 工具或 Agent 客户端，请使用该工具自带的 MCP 添加命令、设置页或导入功能。

如果当前是 CLI 工具，必须通过命令行添加 MCP server；不要直接编辑配置文件（例如 settings.json、config.toml、claude_desktop_config.json 等）来添加。

名称：humen
MCP URL：${mcpUrl}
${secretLine}

如果客户端只能通过 mcpServers JSON 导入或设置页添加，请使用下面内容；不要因为这个示例去手动编辑配置文件：

{
  "mcpServers": {
    "humen": {
      "url": "${mcpUrl}"${headerJson}
    }
  }
}

配置后请重启/刷新 MCP 连接，并执行 tools/list 验证能看到 ask_humen、ask_humen_async、ask_humen_text_async、ask_humen_choice_async、ask_humen_judgment_async、read_humen_replies、create_humen_task、list_humen_tasks、list_online_humens、search_humen_profiles、list_humen_tags。`;
}

async function copyToClipboard(text: string, setStatus: (status: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(t("copied"));
  } catch {
    setStatus(t("copyFailed"));
  }
}

function normalizeOAuthProvider(provider: string) {
  return provider
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function oauthProviderLabel(provider: string) {
  const normalized = normalizeOAuthProvider(provider);
  const preset = oauthPresets.find((item) => item.provider === normalized);
  if (preset) return preset.label;
  return normalized || provider;
}

function oauthStartUrl(provider: string) {
  return apiPath(`/api/auth/oauth/${normalizeOAuthProvider(provider)}/start`);
}

function oauthCallbackUrl(provider: string) {
  return new URL(apiPath(`/api/auth/oauth/${normalizeOAuthProvider(provider)}/callback`), window.location.href).toString();
}

function mergeOAuthSecrets(saved: AdminSettings, draft: AdminSettings): AdminSettings {
  const draftSecrets = new Map(
    draft.oauth_channels.map((channel) => [channel.provider, channel.client_secret ?? ""])
  );
  return {
    ...saved,
    oauth_channels: saved.oauth_channels.map((channel) => ({
      ...channel,
      client_secret: channel.client_secret ?? draftSecrets.get(channel.provider) ?? ""
    }))
  };
}

function imageSource(request: HumanRequest) {
  if (request.image_url) return request.image_url;
  const image = request.image_base64?.trim();
  if (!image) return null;
  if (image.startsWith("data:image/")) return image;
  return `data:${request.image_mime_type || "image/png"};base64,${image}`;
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
  setTasks: (tasks: AgentTask[]) => void,
  setSent: (sent: AnsweredRequest[]) => void,
  setTrash: (trash: ExpiredRequest[]) => void
) {
  localStorage.removeItem(tokenKey);
  setToken("");
  setUser(null);
  setRequests([]);
  setTasks([]);
  setSent([]);
  setTrash([]);
}

createRoot(document.getElementById("root")!).render(<App />);
