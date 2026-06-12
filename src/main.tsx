import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import {
  Ban,
  Bot,
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
  Trophy,
  Trash2,
  UserCircle,
  UserPlus,
  Users,
  Webhook,
  X
} from "lucide-react";
import logoUrl from "./assets/logo.svg";
import "./styles.css";

type TaskKind = "choice" | "judgment" | "text" | "image_review" | "steps";
type View = "inbox" | "tasks" | "sent" | "trash" | "directory" | "leaderboard" | "tags" | "agents" | "agent" | "webhooks" | "settings" | "security";

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

type HumanMemo = {
  id: string;
  target_email: string;
  author_email: string;
  author_agent_id?: string | null;
  author_agent_name?: string | null;
  body: string;
  created_at: number;
  read_at?: number | null;
};

type HumanMemoUnreadSource = {
  author_email: string;
  author_agent_id?: string | null;
  author_agent_name?: string | null;
  count: number;
  latest_at: number;
};

type HumanMemoUnreadSummary = {
  total: number;
  sources: HumanMemoUnreadSource[];
};

type AgentRelationStatus = "none" | "human_requested" | "agent_requested" | "friends";

type AgentHumanMessage = {
  id: string;
  agent_id: string;
  human_email: string;
  direction: "human_to_agent" | "agent_to_human" | string;
  kind: "friend_request" | "ask_me" | string;
  body: string;
  status: "pending" | "resolved" | string;
  created_at: number;
  resolved_at?: number | null;
  read_at?: number | null;
};

type ConnectedAgent = {
  id: string;
  owner_email: string;
  owner_platform_name?: string | null;
  name: string;
  description: string;
  current_task: string;
  last_tool: string;
  first_seen_at: number;
  last_seen_at: number;
  last_request_at?: number | null;
  request_count: number;
  reputation: number;
  ratings_count: number;
  reputation_breakdown?: ReputationBreakdown | null;
  online: boolean;
  relation_status: AgentRelationStatus;
  pending_messages: AgentHumanMessage[];
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

type ReputationBreakdown = {
  seed_source?: string | null;
  seed_score?: number | null;
  seed_weight?: number;
  feedback_weight?: number;
  total_weight?: number;
  confidence?: number;
};

type UserProfile = {
  email: string;
  platform_name: string;
  login?: string | null;
  provider: "password" | "github" | "passkey";
  profile: string;
  tags: string[];
  reputation: number;
  ratings_count: number;
  reputation_breakdown?: ReputationBreakdown | null;
  friend_code?: string;
  intro_code: string;
  visibility?: ProfileVisibility;
  is_public: boolean;
  is_friend: boolean;
  friend_request_sent: boolean;
  friend_request_received: boolean;
  onboarding_completed: boolean;
  online: boolean;
  last_login_at: number;
  last_seen_at?: number | null;
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

type HumanLeaderboardEntry = {
  email: string;
  platform_name: string;
  login?: string | null;
  requests_handled: number;
  sent_tokens: number;
  latest_answered_at?: number | null;
  reputation: number;
  ratings_count: number;
  reputation_breakdown?: ReputationBreakdown | null;
  profile: string;
  tags: string[];
  online: boolean;
};

type HumanReport = {
  id: string;
  reporter_email: string;
  reported_email: string;
  reason: string;
  created_at: number;
  status: string;
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

type PublicKeyCredentialCreationOptionsPayload = PublicKeyCredentialCreationOptionsJSON | {
  publicKey: PublicKeyCredentialCreationOptionsJSON;
};

type PublicKeyCredentialRequestOptionsPayload = PublicKeyCredentialRequestOptionsJSON | {
  publicKey: PublicKeyCredentialRequestOptionsJSON;
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
  options: PublicKeyCredentialCreationOptionsPayload;
};

type PasskeyAuthenticationStart = {
  authentication_id: string;
  options: PublicKeyCredentialRequestOptionsPayload;
};

const appViews = new Set<View>(["inbox", "tasks", "sent", "trash", "directory", "leaderboard", "tags", "agents", "agent", "webhooks", "settings", "security"]);

type WebhookConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  assigned_to?: string | null;
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

type AgentDirectoryVisibility = "public_users" | "reputation_at_least" | "self_and_friends" | "self_only";
type ProfileVisibility = "private" | "friends" | "agents" | "public";
type DirectoryFilter = "all" | "online" | "friends" | "agents" | "public";

type AdminSettings = {
  allow_registration: boolean;
  oauth_channels: OAuthChannelConfig[];
  github_api_token?: string | null;
  github_api_token_configured?: boolean;
  agent_secret_prefix?: string | null;
  allow_agent_directory?: boolean;
  agent_directory_visibility?: AgentDirectoryVisibility;
  agent_directory_min_reputation?: number;
  webhooks?: WebhookConfig[];
};

type AdminUpdateStatus = {
  current_version: string;
  enabled: boolean;
  running: boolean;
  timeout_seconds: number;
};

type AgentAccess = {
  user: string;
  mcp_url: string;
  secret_required: boolean;
  agent_secret_prefix: string;
  user_agent_secret: string;
  agent_secret: string;
  allow_agent_directory?: boolean;
  agent_directory_visibility?: AgentDirectoryVisibility;
  agent_directory_min_reputation?: number;
  friend_code?: string;
  intro_code: string;
  visibility?: ProfileVisibility;
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
  avatarColor: "#0066ff",
  theme: "light",
  language: "zh",
  compact: false
};

const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "xs",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: "900"
  }
});

const profileTemplateEn = `Hi, I can help with human-in-the-loop checks.

Skills: #review #ops #qa
Can help with: approvals, UI checks, deployment checks, account actions, short research
Usually available:
Languages/timezone:
Response style: concise / detailed / screenshots OK
Cannot approve:
Escalation notes:
Trusted contexts:`;

const profileTemplateZh = `你好，我可以协助处理需要人类判断的 Agent 请求。

擅长：#review #ops #qa
可处理：审批、界面检查、部署核验、账号操作、简短调研
通常在线：
语言/时区：
回复偏好：简短 / 详细 / 可截图
不能审批：
升级说明：
可信上下文：`;

function profileTemplate() {
  return currentLanguage() === "en" ? profileTemplateEn : profileTemplateZh;
}

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

const agentDirectoryVisibilityOptions: Array<{
  value: AgentDirectoryVisibility;
  labelKey: string;
  helpKey: string;
}> = [
  { value: "public_users", labelKey: "agentDirectoryPublicUsers", helpKey: "agentDirectoryPublicUsersHelp" },
  { value: "reputation_at_least", labelKey: "agentDirectoryReputation", helpKey: "agentDirectoryReputationHelp" },
  { value: "self_and_friends", labelKey: "agentDirectoryFriends", helpKey: "agentDirectoryFriendsHelp" },
  { value: "self_only", labelKey: "agentDirectorySelfOnly", helpKey: "agentDirectorySelfOnlyHelp" }
];

const profileVisibilityOptions: Array<{
  value: ProfileVisibility;
  labelKey: string;
  helpKey: string;
}> = [
  { value: "private", labelKey: "profileVisibilityPrivate", helpKey: "profileVisibilityPrivateHelp" },
  { value: "friends", labelKey: "profileVisibilityFriends", helpKey: "profileVisibilityFriendsHelp" },
  { value: "agents", labelKey: "profileVisibilityAgents", helpKey: "profileVisibilityAgentsHelp" },
  { value: "public", labelKey: "profileVisibilityPublic", helpKey: "profileVisibilityPublicHelp" }
];

function normalizedProfileVisibility(profile: Pick<UserProfile, "visibility" | "is_public"> | null | undefined): ProfileVisibility {
  return profile?.visibility ?? (profile?.is_public ? "public" : "private");
}

function normalizedAgentDirectoryVisibility(settings: AdminSettings | null | undefined): AgentDirectoryVisibility {
  return settings?.agent_directory_visibility ?? (settings?.allow_agent_directory ? "public_users" : "self_only");
}

function normalizeReputationThreshold(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.min(10, Math.max(0, numeric));
}

function withAgentDirectoryPolicy(settings: AdminSettings, visibility: AgentDirectoryVisibility, minReputation: number): AdminSettings {
  return {
    ...settings,
    allow_agent_directory: visibility !== "self_only",
    agent_directory_visibility: visibility,
    agent_directory_min_reputation: normalizeReputationThreshold(minReputation)
  };
}

const zhText: Record<string, string> = {
  online: "在线",
  refresh: "刷新",
  inbox: "收件箱",
  tasks: "任务",
  sent: "成功发送",
  trash: "回收站",
  directory: "人才库",
  leaderboard: "排行榜",
  tags: "标签",
  agents: "Agents",
  agent: "接入 Agent",
  adminSettings: "管理与设置",
  settings: "设置",
  security: "安全",
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
  adminAccess: "管理员入口",
  hideAdminAccess: "收起管理员入口",
  adminAccessHelp: "账号密码仅供管理员初始化和维护。普通用户请使用管理员配置的 OAuth 登录。",
  loginWithOAuth: "使用 OAuth 登录",
  oauthUnavailable: "OAuth 登录尚未开通，请联系管理员开通账号。",
  passkeyAccess: "已绑定 Passkey？",
  loginHeroTitle: "人类协作入口",
  loginHeroSubtitle: "把 Agent 的审批、判断和短任务交给可信的人处理。每次请求都有范围、身份和审计记录。",
  loginPanelTitle: "登录工作台",
  loginPanelSubtitle: "优先使用 GitHub 或已绑定的 Passkey。",
  loginConsolePrompt: "Agent 正在等待人类判断",
  loginConsoleAnswer: "回复已写入审计记录，Agent 可继续执行",
  loginFlowAgent: "Agent 请求",
  loginFlowAgentHelp: "需要判断、审批或简短文本",
  loginFlowMcp: "ask_humen",
  loginFlowMcpHelp: "通过 /mcp 创建待处理请求",
  loginFlowHuman: "人类处理",
  loginFlowHumanHelp: "按标签、好友和可见范围分派",
  loginFlowAnswer: "返回答案",
  loginFlowAnswerHelp: "带备注和时间写回 Agent",
  loginPreviewPending: "待处理请求",
  loginPreviewAnswered: "已返回回复",
  loginPreviewKind: "类型",
  loginPreviewRoute: "路由",
  loginPreviewTimeout: "超时",
  loginPreviewDecision: "结论",
  loginPreviewAudit: "审计",
  loginPreviewPrompt: "审批登录权限变更后再继续",
  loginPreviewReply: "continue_agent() 收到 answer + note",
  adminLoginFailed: "管理员登录失败",
  passkeySignIn: "使用 Passkey 登录",
  passkeyUseEmail: "请先输入邮箱，再使用 Passkey 登录。",
  passkeyUnsupported: "当前浏览器或当前站点不支持 Passkey。",
  passkeyLoginFailed: "Passkey 登录失败",
  passkeys: "Passkeys",
  passkeyHelp: "登录后可在当前设备或密码管理器中绑定 Passkey；下次输入邮箱后即可无密码登录。",
  addPasskey: "绑定 Passkey",
  passkeyWaiting: "等待设备确认...",
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
  humans: "人才库",
  searchProfile: "搜索人才简介或 #标签",
  introCode: "好友代码",
  addByIntroCode: "按好友代码添加好友",
  addFriend: "添加好友",
  acceptFriend: "接受好友",
  removeFriend: "移除好友",
  friendPending: "已发送申请",
  agentFriends: "Agent 好友",
  noAgents: "暂无已连接 agents",
  agentOwner: "绑定用户",
  agentCurrentTask: "当前任务",
  agentIdle: "暂无任务概况",
  agentLastTool: "最近工具",
  lastSeen: "最后上线",
  unread: "未读",
  read: "已读",
  requestAgentFriend: "加 Agent 好友",
  acceptAgentFriend: "接受 Agent",
  requestAgentAskMe: "发送留言",
  agentFriendAccepted: "已成为 Agent 好友。",
  agentFriendRequested: "已发送 Agent 好友申请。",
  agentAskMePlaceholder: "给这个 agent 绑定用户留言",
  agentAskMeSent: "留言已发送。",
  incomingAgentRequest: "Agent 发来的申请",
  agentPending: "等待 Agent 处理",
  memoBoard: "留言板",
  memoPlaceholder: "给这个人类留言，或记录短期上下文",
  sendMemo: "发送留言",
  noMemos: "暂无留言",
  memoSaved: "留言已保存。",
  profileHome: "个人主页",
  openWorkspace: "打开工作台",
  publicProfileNotFound: "这个用户主页不存在，或资料尚未公开。",
  friends: "好友",
  incomingRequests: "收到的申请",
  outgoingRequests: "已发送申请",
  noHumans: "没有找到人才",
  directoryFilter: "筛选",
  directoryFilterAll: "全部",
  directoryFilterOnline: "在线",
  directoryFilterFriends: "好友",
  directoryFilterAgentVisible: "Agent 可见",
  directoryFilterPublic: "公开",
  noTags: "暂无标签",
  profileMissing: "暂无简介",
  onlineStatus: "在线",
  offlineStatus: "离线",
  openGithubProfile: "GitHub",
  settingsSubtitle: "主题、语言和个人显示偏好",
  adminSubtitle: "主题、语言和个人显示偏好",
  securitySubtitle: "Passkey、注册、OAuth 和用户访问控制",
  securityOverview: "安全总览",
  securityOverviewHelp: "当前账号、登录入口和 Agent 访问边界的实时状态。",
  securityLoginPolicy: "登录与注册",
  securityLoginPolicyHelp: "普通用户优先通过 OAuth 登录；管理员账号密码仅用于初始化和维护。",
  securityAgentBoundary: "Agent 访问边界",
  securityAgentBoundaryHelp: "MCP 请求必须携带 Agent Secret；最终 secret 由管理员前缀和个人 secret 组合而成。",
  securityCurrentSession: "当前会话",
  securityPasskeyStatus: "Passkey",
  securityOAuthStatus: "OAuth",
  securityRegistrationStatus: "新用户注册",
  securityAgentStatus: "Agent Secret",
  securityRuntimeConfig: "当前配置",
  enabledStatus: "已启用",
  disabledStatus: "未启用",
  availableStatus: "可用",
  unavailableStatus: "不可用",
  openStatus: "开放",
  closedStatus: "关闭",
  providerLabel: "登录方式",
  oauthEnabledCount: "已启用渠道",
  oauthDisabled: "未配置可用 OAuth 渠道",
  passkeyReady: "当前浏览器和站点支持 Passkey",
  passkeyNotReady: "当前浏览器或站点不支持 Passkey",
  agentSecretRequired: "MCP 强制校验 secret",
  agentDirectoryScope: "Agent 人才库范围",
  adminPasswordPrivate: "账号密码登录仅保留给管理员",
  oauthIdentityStable: "OAuth 身份绑定公开资料、信誉和 Agent Secret",
  leaderboardSubtitle: "按已处理 Agent 请求数和用户发送 token 量排名",
  requestsHandled: "处理请求",
  sentTokens: "用户发送 Token",
  latestAnswered: "最近处理",
  reputation: "信誉",
  ratingsCount: "评分数",
  reputationEvidence: "证据权重",
  reputationConfidence: "置信度",
  reputationSeed: "初始来源",
  reputationSeedGithub: "GitHub 种子",
  reputationSeedNone: "未初始化",
  reputationDefault: "默认信誉",
  reputationWeightedHelp: "GitHub 初始信誉 + 按评分者信誉加权的反馈",
  rateHuman: "评分",
  rateAgent: "评价 Agent",
  reportHuman: "举报",
  reportReason: "举报原因",
  submitReport: "提交举报",
  submitRating: "提交评分",
  reportSubmitted: "举报已提交给管理员信箱。",
  ratingSubmitted: "评分已提交。",
  adminMailbox: "管理员信箱",
  noReports: "暂无举报",
  leaderboardEmpty: "暂无排行榜数据",
  allHandlers: "上榜人数",
  updatePanel: "更新面板",
  serverUpdate: "服务器更新",
  serverUpdateSubtitle: "从 AUR/包管理器更新后端和面板，并重启服务",
  serverVersion: "服务端",
  selfUpdateEnabled: "自更新已配置",
  selfUpdateDisabled: "自更新未配置",
  startSelfUpdate: "更新服务器",
  updatingServer: "正在启动更新...",
  selfUpdateStarted: "更新已启动，服务可能会重启。",
  selfUpdateFailed: "更新启动失败",
  confirmServerUpdate: "开始服务器自更新？服务可能会短暂重启。",
  frontendVersion: "前端",
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
  profileVisibility: "可见范围",
  profileVisibilityPrivate: "仅自己",
  profileVisibilityPrivateHelp: "不会出现在公开人才库，也不会被 Agent 搜索到；别人只能通过好友码申请。",
  profileVisibilityFriends: "好友可见",
  profileVisibilityFriendsHelp: "你和已接受好友可互相看到；Agent 不能搜索到你。",
  profileVisibilityAgents: "Agent 可见",
  profileVisibilityAgentsHelp: "有效 Agent Secret 可按管理员策略搜索到你；普通用户仍需要好友关系。",
  profileVisibilityPublic: "公开",
  profileVisibilityPublicHelp: "公开人才库、好友发现和 Agent 搜索都可看到你。",
  profile: "简介",
  useTemplate: "使用模板",
  saveProfile: "保存简介",
  savingProfile: "正在保存简介...",
  profileSaved: "简介已保存。",
  saveProfileFailed: "保存简介失败",
  registration: "注册",
  allowNewUsers: "允许新用户注册",
  githubApiToken: "GitHub API Token",
  githubApiTokenHelp: "用于 GitHub 信誉初始化画像抓取，提高 API 额度；明文不会回显。",
  githubApiTokenPlaceholder: "粘贴 fine-grained 或 classic token",
  githubApiTokenConfigured: "Token 已配置",
  githubApiTokenMissing: "Token 未配置",
  clearToken: "清空 token",
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
  allowAgentDirectory: "允许 Agent 查看整个人才库",
  allowAgentDirectoryRisk: "风险：开启后，任何拿到有效 secret 的 Agent 都可以搜索整个人才库，而不只看到自己的账号。",
  agentDirectoryVisibility: "Agent 人才库可见范围",
  agentDirectoryVisibilityHelp: "控制有效 Agent Secret 在 MCP 搜索人才库时能看到哪些账号。",
  agentDirectoryMode: "可见策略",
  agentDirectoryPublicUsers: "全部公开用户",
  agentDirectoryPublicUsersHelp: "可见自己，以及公开出现在人才库的用户。",
  agentDirectoryReputation: "信誉阈值",
  agentDirectoryReputationHelp: "可见自己，以及公开且信誉不低于阈值的用户。",
  agentDirectoryFriends: "自己和好友",
  agentDirectoryFriendsHelp: "只可见自己和已接受的好友。",
  agentDirectorySelfOnly: "仅自己",
  agentDirectorySelfOnlyHelp: "Agent 只能看到 secret 所属账号自己。",
  agentDirectoryMinReputation: "最低信誉",
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
  directory: "Talent Pool",
  leaderboard: "Leaderboard",
  tags: "Tags",
  agents: "Agents",
  agent: "Connect Agent",
  adminSettings: "Admin & Settings",
  settings: "Settings",
  security: "Security",
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
  adminAccess: "Admin access",
  hideAdminAccess: "Hide admin access",
  adminAccessHelp: "Email/password sign-in is only for administrator setup and maintenance. Regular users should use administrator-configured OAuth.",
  loginWithOAuth: "Sign in with OAuth",
  oauthUnavailable: "OAuth sign-in is not configured yet. Ask an administrator to enable your account.",
  passkeyAccess: "Already have a passkey?",
  loginHeroTitle: "Human review for agent work.",
  loginHeroSubtitle: "Route approvals, judgments, and short tasks from agents to trusted humans. Every request keeps scope, identity, and audit context attached.",
  loginPanelTitle: "Enter workspace",
  loginPanelSubtitle: "Use GitHub or a bound passkey first.",
  loginConsolePrompt: "Agent is waiting for human judgment",
  loginConsoleAnswer: "Reply recorded. Agent can continue.",
  loginFlowAgent: "Agent request",
  loginFlowAgentHelp: "Judgment, approval, or short text",
  loginFlowMcp: "ask_humen",
  loginFlowMcpHelp: "Creates a pending request through /mcp",
  loginFlowHuman: "Human review",
  loginFlowHumanHelp: "Routed by tags, friends, and visibility",
  loginFlowAnswer: "Answer returned",
  loginFlowAnswerHelp: "Note and timestamp go back to the agent",
  loginPreviewPending: "Pending request",
  loginPreviewAnswered: "Returned reply",
  loginPreviewKind: "Kind",
  loginPreviewRoute: "Route",
  loginPreviewTimeout: "Timeout",
  loginPreviewDecision: "Decision",
  loginPreviewAudit: "Audit",
  loginPreviewPrompt: "Review login access change before continuing",
  loginPreviewReply: "continue_agent() receives answer + note",
  adminLoginFailed: "Admin login failed",
  passkeySignIn: "Sign in with Passkey",
  passkeyUseEmail: "Enter your email before signing in with a passkey.",
  passkeyUnsupported: "This browser or origin does not support passkeys.",
  passkeyLoginFailed: "Passkey sign-in failed",
  passkeys: "Passkeys",
  passkeyHelp: "After signing in, bind a passkey on this device or password manager. Next time, enter your email and sign in without a password.",
  addPasskey: "Add passkey",
  passkeyWaiting: "Waiting for device...",
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
  humans: "Talent Pool",
  searchProfile: "Search talent profile or #tag",
  introCode: "Friend code",
  addByIntroCode: "Add by friend code",
  addFriend: "Add friend",
  acceptFriend: "Accept friend",
  removeFriend: "Remove friend",
  friendPending: "Request sent",
  agentFriends: "Agent friends",
  noAgents: "No connected agents",
  agentOwner: "Bound user",
  agentCurrentTask: "Current task",
  agentIdle: "No task summary",
  agentLastTool: "Last tool",
  lastSeen: "Last seen",
  unread: "Unread",
  read: "Read",
  requestAgentFriend: "Add agent friend",
  acceptAgentFriend: "Accept agent",
  requestAgentAskMe: "Send memo",
  agentFriendAccepted: "Agent friend accepted.",
  agentFriendRequested: "Agent friend request sent.",
  agentAskMePlaceholder: "Leave a memo for this agent's bound user",
  agentAskMeSent: "Memo sent.",
  incomingAgentRequest: "Incoming agent request",
  agentPending: "Waiting for agent",
  memoBoard: "Memo board",
  memoPlaceholder: "Leave an offline message or short-term context",
  sendMemo: "Send memo",
  noMemos: "No memos yet",
  memoSaved: "Memo saved.",
  profileHome: "Profile home",
  openWorkspace: "Open workspace",
  publicProfileNotFound: "This user home does not exist, or the profile is not public yet.",
  friends: "Friends",
  incomingRequests: "Incoming requests",
  outgoingRequests: "Outgoing requests",
  noHumans: "No talent found",
  directoryFilter: "Filter",
  directoryFilterAll: "All",
  directoryFilterOnline: "Online",
  directoryFilterFriends: "Friends",
  directoryFilterAgentVisible: "Agent visible",
  directoryFilterPublic: "Public",
  noTags: "No tags yet",
  profileMissing: "No profile",
  onlineStatus: "online",
  offlineStatus: "offline",
  openGithubProfile: "GitHub",
  settingsSubtitle: "Theme, language, and personal display preferences",
  adminSubtitle: "Theme, language, and personal display preferences",
  securitySubtitle: "Passkeys, registration, OAuth, and user access controls",
  securityOverview: "Security overview",
  securityOverviewHelp: "Live status for this account, sign-in entry points, and agent access boundaries.",
  securityLoginPolicy: "Login and registration",
  securityLoginPolicyHelp: "Regular users should use OAuth. Email/password sign-in is reserved for administrator setup and maintenance.",
  securityAgentBoundary: "Agent access boundary",
  securityAgentBoundaryHelp: "MCP requests must include an Agent Secret. The final secret combines the administrator prefix and personal secret.",
  securityCurrentSession: "Current session",
  securityPasskeyStatus: "Passkey",
  securityOAuthStatus: "OAuth",
  securityRegistrationStatus: "New user registration",
  securityAgentStatus: "Agent Secret",
  securityRuntimeConfig: "Current configuration",
  enabledStatus: "Enabled",
  disabledStatus: "Disabled",
  availableStatus: "Available",
  unavailableStatus: "Unavailable",
  openStatus: "Open",
  closedStatus: "Closed",
  providerLabel: "Sign-in method",
  oauthEnabledCount: "Enabled channels",
  oauthDisabled: "No enabled OAuth channel",
  passkeyReady: "This browser and origin support passkeys",
  passkeyNotReady: "This browser or origin does not support passkeys",
  agentSecretRequired: "MCP enforces secret checks",
  agentDirectoryScope: "Agent talent pool scope",
  adminPasswordPrivate: "Email/password sign-in is administrator-only",
  oauthIdentityStable: "OAuth identity owns profile, reputation, and Agent Secret",
  leaderboardSubtitle: "Ranked by handled agent requests and user-sent token volume",
  requestsHandled: "Handled requests",
  sentTokens: "User-sent tokens",
  latestAnswered: "Latest answer",
  reputation: "Reputation",
  ratingsCount: "Ratings",
  reputationEvidence: "Evidence weight",
  reputationConfidence: "Confidence",
  reputationSeed: "Seed",
  reputationSeedGithub: "GitHub seed",
  reputationSeedNone: "No seed",
  reputationDefault: "Default reputation",
  reputationWeightedHelp: "GitHub seed plus feedback weighted by rater reputation",
  rateHuman: "Rate",
  rateAgent: "Rate agent",
  reportHuman: "Report",
  reportReason: "Report reason",
  submitReport: "Submit report",
  submitRating: "Submit rating",
  reportSubmitted: "Report sent to the admin mailbox.",
  ratingSubmitted: "Rating submitted.",
  adminMailbox: "Admin mailbox",
  noReports: "No reports",
  leaderboardEmpty: "No leaderboard data yet",
  allHandlers: "Ranked users",
  updatePanel: "Refresh panel",
  serverUpdate: "Server update",
  serverUpdateSubtitle: "Update the backend and panel through AUR/package management, then restart the service",
  serverVersion: "Server",
  selfUpdateEnabled: "Self-update configured",
  selfUpdateDisabled: "Self-update not configured",
  startSelfUpdate: "Update server",
  updatingServer: "Starting update...",
  selfUpdateStarted: "Update started. The service may restart.",
  selfUpdateFailed: "Failed to start update",
  confirmServerUpdate: "Start server self-update? The service may restart briefly.",
  frontendVersion: "Frontend",
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
  profileVisibility: "Visibility",
  profileVisibilityPrivate: "Only me",
  profileVisibilityPrivateHelp: "Hidden from the public talent pool and agent search. Others need your friend code to request access.",
  profileVisibilityFriends: "Friends",
  profileVisibilityFriendsHelp: "Visible to you and accepted friends. Agents cannot search this profile.",
  profileVisibilityAgents: "Agents",
  profileVisibilityAgentsHelp: "Visible to valid Agent Secrets under the admin policy. Regular users still need friendship.",
  profileVisibilityPublic: "Public",
  profileVisibilityPublicHelp: "Visible in the public talent pool, friend discovery, and agent search.",
  profile: "Profile",
  useTemplate: "Use template",
  saveProfile: "Save profile",
  savingProfile: "Saving profile...",
  profileSaved: "Profile saved.",
  saveProfileFailed: "Save profile failed",
  registration: "Registration",
  allowNewUsers: "Allow new users",
  githubApiToken: "GitHub API Token",
  githubApiTokenHelp: "Used for GitHub reputation seeding metadata and higher API quota. The plaintext token is not returned.",
  githubApiTokenPlaceholder: "Paste a fine-grained or classic token",
  githubApiTokenConfigured: "Token configured",
  githubApiTokenMissing: "Token not configured",
  clearToken: "Clear token",
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
  allowAgentDirectory: "Allow agents to see the whole talent pool",
  allowAgentDirectoryRisk: "Risk: when enabled, any agent with a valid secret can search the full talent pool instead of only its own account.",
  agentDirectoryVisibility: "Agent talent pool visibility",
  agentDirectoryVisibilityHelp: "Controls which accounts a valid Agent Secret can see through MCP talent search.",
  agentDirectoryMode: "Visibility policy",
  agentDirectoryPublicUsers: "All public users",
  agentDirectoryPublicUsersHelp: "Visible: self and users shown publicly in the talent pool.",
  agentDirectoryReputation: "Reputation threshold",
  agentDirectoryReputationHelp: "Visible: self and public users whose reputation meets the threshold.",
  agentDirectoryFriends: "Self and friends",
  agentDirectoryFriendsHelp: "Visible: self and accepted friends only.",
  agentDirectorySelfOnly: "Self only",
  agentDirectorySelfOnlyHelp: "Agents only see the account attached to their secret.",
  agentDirectoryMinReputation: "Minimum reputation",
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

function panelRootUrl() {
  return new URL(apiPath("/"), window.location.href).toString();
}

function normalizePanelAssetUrl(value: string, rootUrl = panelRootUrl()) {
  try {
    const url = new URL(value, rootUrl);
    if (url.origin !== window.location.origin) return null;
    url.search = "";
    url.hash = "";
    return url.pathname;
  } catch {
    return null;
  }
}

function collectPanelAssets(root: ParentNode, rootUrl = panelRootUrl()) {
  const assets = [
    ...Array.from(root.querySelectorAll<HTMLScriptElement>("script[src]")).map((element) => element.getAttribute("src") ?? ""),
    ...Array.from(root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href], link[rel="modulepreload"][href]')).map(
      (element) => element.getAttribute("href") ?? ""
    )
  ]
    .map((asset) => normalizePanelAssetUrl(asset, rootUrl))
    .filter((asset): asset is string => Boolean(asset));
  return Array.from(new Set(assets)).sort();
}

function extractPanelAssets(html: string, rootUrl = panelRootUrl()) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return collectPanelAssets(document, rootUrl);
}

function samePanelAssets(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((asset) => leftSet.has(asset));
}

async function latestPanelAssets() {
  const url = new URL(panelRootUrl());
  url.searchParams.set("panel_check", Date.now().toString());
  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "cache-control": "no-cache" }
  });
  if (!response.ok) return [];
  return extractPanelAssets(await response.text(), url.toString());
}

async function panelUpdateAvailable() {
  try {
    const currentAssets = collectPanelAssets(document);
    const remoteAssets = await latestPanelAssets();
    return currentAssets.length > 0 && remoteAssets.length > 0 && !samePanelAssets(currentAssets, remoteAssets);
  } catch (error) {
    console.warn("Panel update check failed", error);
    return false;
  }
}

function reloadPanel() {
  const url = new URL(window.location.href);
  url.searchParams.set("panel_reload", Date.now().toString());
  window.location.replace(url.toString());
}

function FrontendVersion() {
  return (
    <span className="frontendVersion" title={`humen-mcp-webui ${__APP_COMMIT__}`}>
      {t("frontendVersion")} {__APP_COMMIT__}
    </span>
  );
}

function BrandLockup() {
  return (
    <div className="brandLockup">
      <img className="appLogo" src={logoUrl} alt="" />
      <h1>humen-mcp</h1>
    </div>
  );
}

function UpdatePanelControl({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="panelRefreshGroup">
      <button className="secondary" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw size={17} className={refreshing ? "spin" : ""} /> {t("updatePanel")}
      </button>
      <FrontendVersion />
    </div>
  );
}

function wsPath(token: string) {
  const path = token ? `/api/ws?token=${encodeURIComponent(token)}` : "/api/ws";
  const url = new URL(apiPath(path), window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function initialView(): View {
  const value = new URLSearchParams(window.location.search).get("view");
  return value && appViews.has(value as View) ? (value as View) : "inbox";
}

type AppProps = {
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
};

function App({ preferences, setPreferences }: AppProps) {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [requests, setRequests] = useState<HumanRequest[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [sent, setSent] = useState<AnsweredRequest[]>([]);
  const [trash, setTrash] = useState<ExpiredRequest[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [leaderboard, setLeaderboard] = useState<HumanLeaderboardEntry[]>([]);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminReports, setAdminReports] = useState<HumanReport[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [memoUnread, setMemoUnread] = useState<HumanMemoUnreadSummary>({ total: 0, sources: [] });
  const [memoRefreshSeq, setMemoRefreshSeq] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const profileSlug = publicProfileSlug();

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId]
  );
  const activeTaskCount = useMemo(() => tasks.filter((task) => task.status !== "done" && task.status !== "archived").length, [tasks]);
  const unreadAgentMessages = useMemo(
    () => agents.filter((agent) => agent.pending_messages.some((message) => !message.read_at)).length,
    [agents]
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
    fetch(apiPath("/api/me"), { headers: authHeaders(token) })
      .then((response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => logout(setToken, setUser, setRequests, setTasks, setSent, setTrash, setWebhooks));
  }, [token]);

  useEffect(() => {
    if (!user) return;
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
        refreshLeaderboard(token, setLeaderboard);
      }
      if (message.type === "request_expired") {
        setRequests((current) => current.filter((request) => request.id !== message.id));
        setTrash((current) => sortTrash([message.expired_request, ...current]));
      }
      if (message.type === "task_created" || message.type === "task_updated") {
        setTasks((current) => upsertAgentTask(current, message.task));
      }
      if (message.type === "memo_created") {
        setMemoRefreshSeq((current) => current + 1);
        refreshMemoUnread(token, setMemoUnread);
      }
      if (message.type === "trash_cleaned") {
        refreshTrash(token, setTrash);
      }
      if (message.type === "presence_changed") {
        setOnlineCount(message.online_count);
        refreshUsers(token, setOnlineUsers, setDirectory, setTagStats);
        refreshLeaderboard(token, setLeaderboard);
      }
    };
    return () => ws.close();
  }, [token, user]);

  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => {
      refreshDirectory(token, setDirectory, query);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, token, user]);

  async function refreshAll() {
    setBusy(true);
    try {
      if (isAdmin && await panelUpdateAvailable()) {
        reloadPanel();
        return;
      }
      await Promise.all([
        refreshRequests(token, setRequests),
        refreshTasks(token, setTasks),
        refreshSent(token, setSent),
        refreshLeaderboard(token, setLeaderboard),
        refreshTrash(token, setTrash),
        refreshAgents(token, setAgents),
        refreshMemoUnread(token, setMemoUnread),
        refreshWebhooks(token, setWebhooks),
        refreshUsers(token, setOnlineUsers, setDirectory, setTagStats),
        refreshAdmin(token, setIsAdmin, setAdminUsers, setAdminSettings, setAdminReports)
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (profileSlug) {
    return <PublicProfilePage slug={profileSlug} token={token} currentUser={user?.email ?? ""} />;
  }

  if (!user) {
    return <Login onToken={setToken} />;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div>
            <BrandLockup />
            <p>{onlineCount} {t(t("onlineStatus"))}</p>
          </div>
          <button className="iconButton" title={t("refresh")} onClick={refreshAll}>
            <RefreshCw size={18} className={busy ? "spin" : ""} />
          </button>
        </div>

        <nav className="navList">
          <NavButton icon={<Inbox size={18} />} label={t("inbox")} count={requests.length} active={view === "inbox"} unread={requests.length > 0} onClick={() => setView("inbox")} />
          <NavButton icon={<ListChecks size={18} />} label={t("tasks")} count={activeTaskCount} active={view === "tasks"} unread={activeTaskCount > 0} onClick={() => setView("tasks")} />
          <NavButton icon={<Webhook size={18} />} label="微信 / Webhooks" count={webhooks.length} active={view === "webhooks"} onClick={() => setView("webhooks")} />
          <NavButton icon={<Send size={18} />} label={t("sent")} count={sent.length} active={view === "sent"} onClick={() => setView("sent")} />
          <NavButton icon={<Trash2 size={18} />} label={t("trash")} count={trash.length} active={view === "trash"} onClick={() => setView("trash")} />
          <NavButton icon={<Users size={18} />} label={t("directory")} count={onlineUsers.length} active={view === "directory"} unread={memoUnread.total > 0} onClick={() => setView("directory")} />
          <NavButton icon={<Trophy size={18} />} label={t("leaderboard")} count={leaderboard.length} active={view === "leaderboard"} onClick={() => setView("leaderboard")} />
          <NavButton icon={<Tags size={18} />} label={t("tags")} count={tagStats.length} active={view === "tags"} onClick={() => setView("tags")} />
          <NavButton icon={<Bot size={18} />} label={t("agents")} count={agents.filter((agent) => agent.online).length} active={view === "agents"} unread={unreadAgentMessages > 0} onClick={() => setView("agents")} />
          <NavButton icon={<MessageSquareText size={18} />} label={t("agent")} active={view === "agent"} onClick={() => setView("agent")} />
          <NavButton icon={<Settings size={18} />} label={t("settings")} active={view === "settings"} onClick={() => setView("settings")} />
          <NavButton icon={<Shield size={18} />} label={t("security")} active={view === "security"} onClick={() => setView("security")} />
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
          onLogout={() => logout(setToken, setUser, setRequests, setTasks, setSent, setTrash, setWebhooks)}
        />
        {view === "inbox" && (selected ? <TaskPanel request={selected} token={token} now={now} afterSubmit={() => setSelectedId(null)} /> : <Blank />)}
        {view === "tasks" && <AgentTasksView tasks={tasks} token={token} setTasks={setTasks} />}
        {view === "sent" && <SentView sent={sent} token={token} setSent={setSent} />}
        {view === "trash" && <TrashView trash={trash} token={token} setTrash={setTrash} />}
        {view === "directory" && <DirectoryView query={query} setQuery={setQuery} users={directory} tags={tagStats} token={token} currentUser={user.email} memoUnread={memoUnread} memoRefreshSeq={memoRefreshSeq} onMemoUnreadChanged={() => refreshMemoUnread(token, setMemoUnread)} onChanged={() => {
          refreshUsers(token, setOnlineUsers, setDirectory, setTagStats);
          refreshLeaderboard(token, setLeaderboard);
          refreshMemoUnread(token, setMemoUnread);
        }} />}
        {view === "leaderboard" && <LeaderboardView entries={leaderboard} token={token} setEntries={setLeaderboard} />}
        {view === "tags" && <TagsView tags={tagStats} setQuery={setQuery} setView={setView} />}
        {view === "agents" && <AgentsView token={token} agents={agents} setAgents={setAgents} />}
        {view === "agent" && (
          <AgentView
            token={token}
            isAdmin={isAdmin}
            settings={adminSettings}
            setSettings={setAdminSettings}
          />
        )}
        {view === "webhooks" && (
          <WebhookView
            token={token}
            settings={isAdmin ? adminSettings : null}
            webhooks={webhooks}
            users={isAdmin ? adminUsers : []}
            currentUser={user.email}
            isAdmin={isAdmin}
            setSettings={setAdminSettings}
            setWebhooks={setWebhooks}
          />
        )}
        {view === "settings" && (
          <AccountView token={token} user={user} preferences={preferences} setPreferences={setPreferences} />
        )}
        {view === "security" && isAdmin && (
          adminSettings ? (
            <AdminView
              token={token}
              users={adminUsers}
              settings={adminSettings}
              reports={adminReports}
              setUsers={setAdminUsers}
              setSettings={setAdminSettings}
              setReports={setAdminReports}
              onRefresh={refreshAll}
              refreshing={busy}
            />
          ) : (
            <SecurityView
              token={token}
              user={user}
              notice="Admin APIs are not available on this backend version yet."
            />
          )
        )}
        {view === "security" && !isAdmin && (
          <SecurityView token={token} user={user} />
        )}
      </section>
    </main>
  );
}

function PublicProfilePage({ slug, token, currentUser }: { slug: string; token: string; currentUser: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setProfile(null);
    setMissing(false);
    fetch(apiPath(`/api/public/users/${encodeURIComponent(slug)}`))
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return safeJson<UserProfile>(response);
      })
      .then((profile) => {
        if (profile) setProfile(profile);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [slug]);

  return (
    <main className="loginShell publicProfileShell">
      <header className="loginNav">
        <BrandLockup />
        <a className="sourceLink" href="/mcp/">{t("openWorkspace")}</a>
      </header>
      <section className="publicProfilePage">
        <div className="pageTitle">
          <div>
            <h2>{profile ? displayIdentity(profile) : `@${slug}`}</h2>
            <p>{t("publicProfile")}</p>
          </div>
          {profile && profileHomePath(profile) && (
            <a className="secondary small" href={profileHomePath(profile)!}>
              <UserCircle size={15} /> {profileHomePath(profile)}
            </a>
          )}
        </div>
        {profile && (
          <div className="gridList">
            <UserCard
              profile={profile}
              token={token}
              currentUser={currentUser}
              memoUnreadCount={0}
              memoRefreshSeq={0}
            />
          </div>
        )}
        {!profile && !missing && <Blank text={t("waiting")} />}
        {missing && <Blank text={t("publicProfileNotFound")} />}
      </section>
    </main>
  );
}

function Login({ onToken }: { onToken: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ github_enabled: false, allow_registration: true });
  const [publicLeaderboard, setPublicLeaderboard] = useState<HumanLeaderboardEntry[]>([]);

  useEffect(() => {
    fetch(apiPath("/api/auth/config"))
      .then((response) => safeJson<AuthConfig>(response))
      .then((config) => setAuthConfig(config ?? { github_enabled: false, allow_registration: false, oauth_channels: [] }))
      .catch(() => setAuthConfig({ github_enabled: false, allow_registration: false, oauth_channels: [] }));
    fetch(apiPath("/api/public/leaderboard"))
      .then((response) => safeJson<HumanLeaderboardEntry[]>(response))
      .then((entries) => setPublicLeaderboard(entries ?? []))
      .catch(() => setPublicLeaderboard([]));
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

  const oauthEnabled = authConfig.github_enabled || (authConfig.oauth_channels ?? []).some((channel) => channel.enabled);

  return (
    <main className="loginShell">
      <header className="loginNav">
        <BrandLockup />
        <SourceLink />
      </header>
      <section className="loginHeroLayout">
        <section className="loginHeroCopy">
          <span className="loginEyebrow">humen-mcp / ask_humen</span>
          <h2>{t("loginHeroTitle")}</h2>
          <p>{t("loginHeroSubtitle")}</p>
          <div className="loginHeroMetrics" aria-label="humen-mcp status">
            <span><strong>/mcp</strong> endpoint</span>
            <span><strong>passkey</strong> ready</span>
            <span><strong>audit</strong> logged</span>
          </div>
          <LoginConsolePreview />
        </section>

        <section className="loginPanel">
          <div className="loginPanelHead">
            <span className="loginPanelIcon"><Shield size={18} /></span>
            <div>
              <h3>{t("loginPanelTitle")}</h3>
              <p>{t("loginPanelSubtitle")}</p>
            </div>
          </div>
          <div className="loginPrimaryAuth">
            <span>{t("loginWithOAuth")}</span>
            {oauthEnabled ? <OAuthLoginButtons config={authConfig} /> : <p className="loginNotice">{t("oauthUnavailable")}</p>}
          </div>

          {authConfig.passkey_enabled !== false && (
            <div className="passkeyLogin">
              <label>
                {t("passkeyAccess")}
                <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder={t("email")} />
              </label>
              <button className="secondary" type="button" onClick={signInWithPasskey} disabled={passkeyBusy}>
                <KeyRound size={18} /> {t("passkeySignIn")}
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button className="adminLoginToggle" type="button" onClick={() => setShowAdminLogin((value) => !value)}>
            <Shield size={15} /> {showAdminLogin ? t("hideAdminAccess") : t("adminAccess")}
          </button>

          {showAdminLogin && (
            <form className="adminLoginForm" onSubmit={submit}>
              <p>{t("adminAccessHelp")}</p>
              <label>
                {t("email")}
                <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </label>
              <label>
                {t("password")}
                <input value={pass} onChange={(event) => setPass(event.target.value)} type="password" autoComplete="current-password" />
              </label>
              <button className="primary" type="submit">
                <Check size={18} /> {t("adminSignIn")}
              </button>
            </form>
          )}
        </section>
      </section>
      <LoginFlowStage />
      <LoginPublicSections leaderboard={publicLeaderboard} />
    </main>
  );
}

function LoginConsolePreview() {
  const rows = [
    { label: "agent", value: "codex.run", state: "online" },
    { label: "route", value: "/mcp ask_humen", state: "90s" },
    { label: "scope", value: "friends + agents", state: "policy" },
    { label: "reply", value: "human.reviewed", state: "audit" }
  ];

  return (
    <section className="loginConsolePreview" aria-label="request console preview">
      <div className="consoleTopbar">
        <span />
        <span />
        <span />
        <code>{apiPath("/mcp")}</code>
      </div>
      <div className="consoleBody">
        <div className="consolePrompt">
          <Send size={16} />
          <span>{t("loginConsolePrompt")}</span>
        </div>
        <div className="consoleRows">
          {rows.map((row) => (
            <div className="consoleRow" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <em>{row.state}</em>
            </div>
          ))}
        </div>
        <div className="consoleAnswer">
          <Check size={16} />
          <span>{t("loginConsoleAnswer")}</span>
        </div>
      </div>
    </section>
  );
}

function LoginFlowStage() {
  const flowSteps = [
    {
      icon: <Send size={20} />,
      label: t("loginFlowAgent"),
      meta: "request.kind",
      help: t("loginFlowAgentHelp")
    },
    {
      icon: <Webhook size={20} />,
      label: t("loginFlowMcp"),
      meta: "/mcp",
      help: t("loginFlowMcpHelp")
    },
    {
      icon: <Users size={20} />,
      label: t("loginFlowHuman"),
      meta: "tags[]",
      help: t("loginFlowHumanHelp")
    },
    {
      icon: <MessageSquareText size={20} />,
      label: t("loginFlowAnswer"),
      meta: "answer.note",
      help: t("loginFlowAnswerHelp")
    }
  ];

  return (
    <section className="loginFlowStage" aria-label="humen-mcp request flow">
      <div className="handoffRail">
        {flowSteps.map((step) => (
          <article className="handoffStep" key={step.label}>
            <span className="handoffIcon">{step.icon}</span>
            <span>
              <strong>{step.label}</strong>
              <code>{step.meta}</code>
            </span>
            <small>{step.help}</small>
          </article>
        ))}
      </div>

      <div className="requestPreview">
        <article className="requestPreviewPanel">
          <div className="previewHeader">
            <Inbox size={18} />
            <strong>{t("loginPreviewPending")}</strong>
            <span>req_42c9</span>
          </div>
          <dl>
            <div>
              <dt>{t("loginPreviewKind")}</dt>
              <dd>choice</dd>
            </div>
            <div>
              <dt>{t("loginPreviewRoute")}</dt>
              <dd>/mcp</dd>
            </div>
            <div>
              <dt>{t("loginPreviewTimeout")}</dt>
              <dd>90s</dd>
            </div>
          </dl>
          <p>{t("loginPreviewPrompt")}</p>
        </article>

        <article className="requestPreviewPanel answered">
          <div className="previewHeader">
            <Check size={18} />
            <strong>{t("loginPreviewAnswered")}</strong>
            <span>human@team</span>
          </div>
          <dl>
            <div>
              <dt>{t("loginPreviewDecision")}</dt>
              <dd>approve</dd>
            </div>
            <div>
              <dt>{t("loginPreviewAudit")}</dt>
              <dd>answered_at</dd>
            </div>
          </dl>
          <p>{t("loginPreviewReply")}</p>
        </article>
      </div>
    </section>
  );
}

function LoginPublicSections({ leaderboard }: { leaderboard: HumanLeaderboardEntry[] }) {
  const copy = loginPublicCopy();
  const securityIcons = [
    <Shield size={20} />,
    <KeyRound size={20} />,
    <Github size={20} />,
    <Trophy size={20} />,
    <Ban size={20} />,
    <Check size={20} />
  ];
  const handledRows = [...leaderboard]
    .filter((entry) => entry.requests_handled > 0)
    .sort((a, b) => b.requests_handled - a.requests_handled)
    .slice(0, 3);
  const tokenRows = [...leaderboard]
    .filter((entry) => entry.sent_tokens > 0)
    .sort((a, b) => b.sent_tokens - a.sent_tokens)
    .slice(0, 3);
  const reputationRows = [...leaderboard]
    .filter((entry) => (entry.reputation_breakdown?.total_weight ?? 0) > 0 || entry.ratings_count > 0)
    .sort((a, b) => b.reputation - a.reputation || (b.reputation_breakdown?.confidence ?? 0) - (a.reputation_breakdown?.confidence ?? 0))
    .slice(0, 3);

  return (
    <section className="loginPublicContent">
      <section className="introSection securityIntro">
        <div className="introHeader">
          <span className="loginEyebrow">{copy.security.eyebrow}</span>
          <h2>{copy.security.title}</h2>
          <p>{copy.security.body}</p>
        </div>
        <div className="introCardGrid">
          {copy.security.items.map((item, index) => (
            <article className="introCard" key={item.title}>
              <span className="introIcon">{securityIcons[index]}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="introSection splitIntro">
        <div className="introHeader">
          <span className="loginEyebrow">{copy.leaderboard.eyebrow}</span>
          <h2>{copy.leaderboard.title}</h2>
          <p>{copy.leaderboard.body}</p>
        </div>
        <div className="leaderboardPreview">
          <article className="publicBoard">
            <div className="publicBoardHead">
              <Trophy size={18} />
              <strong>{copy.leaderboard.handledTitle}</strong>
            </div>
            {handledRows.length > 0 ? (
              <ol>
                {handledRows.map((entry, index) => (
                  <li key={entry.email}><span>#{index + 1}</span><strong>{displayIdentity(entry)}</strong><em>{formatNumber(entry.requests_handled)}</em></li>
                ))}
              </ol>
            ) : (
              <p className="publicBoardEmpty">{copy.leaderboard.empty}</p>
            )}
          </article>
          <article className="publicBoard">
            <div className="publicBoardHead">
              <Send size={18} />
              <strong>{copy.leaderboard.tokenTitle}</strong>
            </div>
            {tokenRows.length > 0 ? (
              <ol>
                {tokenRows.map((entry, index) => (
                  <li key={entry.email}><span>#{index + 1}</span><strong>{displayIdentity(entry)}</strong><em>{formatCompactNumber(entry.sent_tokens)}</em></li>
                ))}
              </ol>
            ) : (
              <p className="publicBoardEmpty">{copy.leaderboard.empty}</p>
            )}
          </article>
          <article className="publicBoard">
            <div className="publicBoardHead">
              <Shield size={18} />
              <strong>{copy.leaderboard.reputationTitle}</strong>
            </div>
            {reputationRows.length > 0 ? (
              <ol>
                {reputationRows.map((entry, index) => (
                  <li key={entry.email}>
                    <span>#{index + 1}</span>
                    <strong>{displayIdentity(entry)}</strong>
                    <em>{formatScore(entry.reputation)}</em>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="publicBoardEmpty">{copy.leaderboard.empty}</p>
            )}
          </article>
        </div>
      </section>

      <section className="introSection splitIntro">
        <div className="introPanel">
          <span className="introIcon"><UserPlus size={20} /></span>
          <h2>{copy.friends.title}</h2>
          {copy.friends.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="introPanel">
          <span className="introIcon"><Users size={20} /></span>
          <h2>{copy.examples.title}</h2>
          <div className="exampleList">
            {copy.examples.items.map((item) => (
              <div key={item.kind}>
                <code>{item.kind}</code>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <p>{copy.examples.body}</p>
        </div>
      </section>

      <section className="introSection integrationIntro">
        <div className="introHeader">
          <span className="loginEyebrow">{copy.integrations.eyebrow}</span>
          <h2>{copy.integrations.title}</h2>
          <p>{copy.integrations.body}</p>
        </div>
        <div className="integrationGrid">
          {copy.integrations.items.map((item, index) => (
            <article className={`introCard wide ${item.planned ? "planned" : ""}`} key={item.title}>
              <span className="introIcon">
                {[<Webhook size={20} />, <QrCode size={20} />, <Plus size={20} />, <MessageSquareText size={20} />][index]}
              </span>
              <div className="introCardTitle">
                <h3>{item.title}</h3>
                {item.planned && <span className="plannedBadge">{copy.integrations.plannedLabel}</span>}
              </div>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function loginPublicCopy() {
  if (currentLanguage() === "en") {
    return {
      security: {
        eyebrow: "security model",
        title: "Security design: separate what an agent can do, who it can reach, and who is accountable for the answer",
        body: "humen-mcp is not a public question box. It is a human collaboration layer with identity, secrets, reputation, friend scopes, and an audit trail.",
        items: [
          {
            title: "Agent Secret",
            body: "MCP requests require an Agent Secret. The current secret is composed from an administrator prefix plus a personal secret; rotating the prefix invalidates old agent access globally."
          },
          {
            title: "Passwordless login",
            body: "After signing in, users can bind a WebAuthn passkey. Later sign-ins only need the email plus device or password-manager verification."
          },
          {
            title: "GitHub identity binding",
            body: "OAuth sign-in binds the account to the email/login returned by GitHub. Public profile, tags, friends, reputation, and Agent Secret all belong to that stable identity."
          },
          {
            title: "Initial reputation",
            body: "GitHub OAuth seeds a baseline from account age, public repositories, sampled stars, follower count, source-repo ratio, and recent public activity."
          },
          {
            title: "Report algorithm",
            body: "Reports go to the administrator mailbox and also write a zero-score feedback signal from the reporter, weighted by the reporter's own reputation."
          },
          {
            title: "Service scoring",
            body: "Users or agent owners can rate collaborators from 0 to 10. Reputation blends the GitHub seed with feedback weighted by each rater's current reputation."
          }
        ]
      },
      leaderboard: {
        eyebrow: "public leaderboard",
        title: "Leaderboard mechanics are visible on the homepage",
        body: "Before signing in, visitors can understand the community incentives: handled requests, output token contribution, and weighted trust scores with evidence.",
        handledTitle: "Human handled requests",
        tokenTitle: "Output token leaderboard",
        reputationTitle: "Weighted reputation",
        empty: "No public leaderboard data yet"
      },
      friends: {
        title: "Friend system",
        paragraphs: [
          "Every user has a friend code. Others can send requests from a public profile or by entering that code; accepted requests create a mutual friendship.",
          "Administrators can restrict the agent directory to self and friends, so private teams route work only to trusted people."
        ]
      },
      examples: {
        title: "What agents ask humans",
        body: "Common use cases include release approval, UI screenshot review, account operations, content compliance, short research, and production-change confirmation.",
        items: [
          { kind: "choice", text: "May the agent run this database migration?" },
          { kind: "judgment", text: "Does this response meet the compliance requirement?" },
          { kind: "text", text: "Write a one-sentence human confirmation for this PR." },
          { kind: "image_review", text: "Check whether the login button is covered in this screenshot." },
          { kind: "steps", text: "Open the admin console, enable the account, and report the result." }
        ]
      },
      integrations: {
        eyebrow: "integrations",
        title: "Webhook, personal WeChat, and community plugins",
        body: "Beyond the web inbox, humen-mcp is connecting human replies to external IM systems and community extensions.",
        plannedLabel: "In development",
        items: [
          {
            title: "Webhook mechanism",
            body: "Administrators can configure webhooks to push new agent requests to external systems. Replies can be mapped back by request ID or short ID."
          },
          {
            title: "Built-in personal WeChat access",
            body: "The built-in WeChat webhook type supports QR code, status, bot token, polling timeout, and API timeout settings for handling requests from personal WeChat."
          },
          {
            title: "Community plugin support",
            body: "Request templates, routing policies, scoring rules, and third-party channels will be extensible through plugins.",
            planned: true
          },
          {
            title: "More built-in IM support",
            body: "More instant messaging channels will bring agent requests into the workflows teams already use.",
            planned: true
          }
        ]
      }
    };
  }

  return {
    security: {
      eyebrow: "安全模型",
      title: "安全设计：把 Agent 能做什么、能找谁、谁负责回答拆开控制",
      body: "humen-mcp 的核心不是一个公开问答箱，而是带身份、secret、信誉、好友和审计记录的人类协作层。",
      items: [
        {
          title: "Agent Secret 机制",
          body: "MCP 请求需要 Agent Secret。当前 secret 由管理员前缀和个人 secret 组合而成，管理员轮换前缀即可让旧 Agent 接入整体失效。"
        },
        {
          title: "无密码登录",
          body: "用户登录后可绑定 WebAuthn Passkey；后续只需输入邮箱并完成设备或密码管理器验证，不再依赖站点密码。"
        },
        {
          title: "GitHub 开源身份绑定",
          body: "OAuth 登录把账号绑定到 GitHub 返回的 email/login，公开资料、标签、好友关系、信誉和 Agent Secret 都归属到这个稳定身份。"
        },
        {
          title: "初始信誉算法",
          body: "GitHub OAuth 会根据账号年龄、公开仓库、抽样 star、粉丝数、源码仓库占比和近期公开活动写入初始信誉种子。"
        },
        {
          title: "举报算法",
          body: "举报会进入管理员信箱，同时由举报者写入一条 0 分反馈信号；这条信号也会按举报者自身信誉加权。"
        },
        {
          title: "服务打分设计",
          body: "用户或 Agent owner 可按 0-10 分评价协作者。信誉由 GitHub 种子和按评分者当前信誉加权的反馈共同决定。"
        }
      ]
    },
    leaderboard: {
      eyebrow: "公开排行榜",
      title: "排行榜玩法公开在首页",
      body: "登录前就能理解社区激励：谁处理了更多 Agent 请求、谁贡献了更多输出 token、谁的加权信誉有足够证据支撑。",
      handledTitle: "人类处理榜",
      tokenTitle: "输出 token 榜",
      reputationTitle: "加权信誉榜",
      empty: "暂无公开排行榜数据"
    },
    friends: {
      title: "好友机制",
      paragraphs: [
        "每个用户都有好友代码。别人可以通过公开资料或好友代码发起申请，接受后双方进入好友关系。",
        "管理员可以把 Agent 人才库可见范围限制为“仅自己和好友”，让私有团队只把请求路由给可信熟人。"
      ]
    },
    examples: {
      title: "Agent 会问人类什么",
      body: "典型场景包括发布审批、UI 截图复核、账号操作、内容合规、短调研、生产环境变更确认。",
      items: [
        { kind: "choice", text: "是否允许 Agent 执行数据库迁移？" },
        { kind: "judgment", text: "这段回复是否满足合规要求？" },
        { kind: "text", text: "给这个 PR 写一句人类确认意见。" },
        { kind: "image_review", text: "检查截图里的登录按钮是否被遮挡。" },
        { kind: "steps", text: "按步骤在后台完成账号开通并回填结果。" }
      ]
    },
    integrations: {
      eyebrow: "集成能力",
      title: "Webhook、个人微信和社区插件",
      body: "除了网页收件箱，humen-mcp 也在把人类回复接到外部 IM 和社区扩展里。",
      plannedLabel: "开发中",
      items: [
        {
          title: "Webhook 机制",
          body: "管理员可配置 Webhook，把新的 Agent 请求推送到外部系统；外部系统回复后再映射回请求 ID 或短 ID。"
        },
        {
          title: "内置个人微信接入",
          body: "内置 WeChat/微信 Webhook 类型支持二维码、状态、bot token、轮询超时等配置，适合把请求同步到个人微信处理。"
        },
        {
          title: "社区插件支持",
          body: "把请求模板、路由策略、评分规则和第三方通道做成插件，让社区扩展新的协作方式。",
          planned: true
        },
        {
          title: "更多内置 IM 支持",
          body: "继续补充更多即时通讯通道，让 Agent 请求可以出现在团队已经使用的工作流里。",
          planned: true
        }
      ]
    }
  };
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

function NavButton({
  icon,
  label,
  count,
  active,
  unread = false,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  unread?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`navButton ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span className="navLabel">
        {label}
        {unread && <span className="unreadDot" title={t("unread")} />}
      </span>
      {count !== undefined && <strong className={unread ? "unreadCount" : ""}>{count}</strong>}
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
        <button className="primary" onClick={submit} disabled={submitting || !answer.trim() || now >= request.expires_at}>
          <Send size={18} /> {t("sendAnswer")}
        </button>
      </footer>
    </article>
  );
}

function SentView({ sent, token, setSent }: { sent: AnsweredRequest[]; token: string; setSent: (sent: AnsweredRequest[]) => void }) {
  async function remove(id: string) {
    if (await hideRequest(token, id)) {
      setSent(sent.filter((entry) => entry.request.id !== id));
    }
  }

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
              <button className="secondary small" onClick={() => remove(entry.request.id)}>
                <Trash2 size={15} /> {t("remove")}
              </button>
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

  async function remove(id: string) {
    if (await hideRequest(token, id)) {
      setTrash(trash.filter((entry) => entry.request.id !== id));
    }
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
              <button className="secondary small" onClick={() => remove(entry.request.id)}>
                <Trash2 size={15} /> {t("remove")}
              </button>
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

function LeaderboardView({
  entries,
  token,
  setEntries
}: {
  entries: HumanLeaderboardEntry[];
  token: string;
  setEntries: (entries: HumanLeaderboardEntry[]) => void;
}) {
  const totalRequests = entries.reduce((sum, entry) => sum + entry.requests_handled, 0);
  const totalTokens = entries.reduce((sum, entry) => sum + entry.sent_tokens, 0);

  async function refresh() {
    await refreshLeaderboard(token, setEntries);
  }

  return (
    <section className="page leaderboardPage">
      <div className="pageTitle">
        <div>
          <h2>{t("leaderboard")}</h2>
          <p>{t("leaderboardSubtitle")}</p>
        </div>
        <button className="secondary" onClick={refresh}>
          <RefreshCw size={17} /> {t("refresh")}
        </button>
      </div>

      <div className="leaderboardStats">
        <article className="metricPanel">
          <span>{t("allHandlers")}</span>
          <strong>{entries.length}</strong>
        </article>
        <article className="metricPanel">
          <span>{t("requestsHandled")}</span>
          <strong>{formatNumber(totalRequests)}</strong>
        </article>
        <article className="metricPanel">
          <span>{t("sentTokens")}</span>
          <strong>{formatCompactNumber(totalTokens)}</strong>
        </article>
      </div>

      <div className="leaderboardList">
        {entries.map((entry, index) => (
          <article className="leaderboardRow" key={entry.email}>
            <div className="rankBadge">#{index + 1}</div>
            <div className="leaderIdentity">
              <div className="avatarCircle">{initials(displayIdentity(entry))}</div>
              <div>
                <strong>{displayIdentity(entry)}</strong>
                <p>{entry.profile || t("profileMissing")}</p>
                <div className="tagRow">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </div>
            </div>
            <div className="leaderMetrics">
              <span>
                <strong>{formatNumber(entry.requests_handled)}</strong>
                {t("requestsHandled")}
              </span>
              <span>
                <strong>{formatCompactNumber(entry.sent_tokens)}</strong>
                {t("sentTokens")}
              </span>
              <span>
                <strong>{entry.latest_answered_at ? formatTime(entry.latest_answered_at) : "-"}</strong>
                {t("latestAnswered")}
              </span>
              <ReputationBadge
                score={entry.reputation}
                count={entry.ratings_count}
                breakdown={entry.reputation_breakdown}
              />
              <span className={entry.online ? "status onlineStatus" : "status"}>
                {entry.online ? t("onlineStatus") : t("offlineStatus")}
              </span>
            </div>
          </article>
        ))}
        {entries.length === 0 && <Blank text={t("leaderboardEmpty")} />}
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
  memoUnread,
  memoRefreshSeq,
  onMemoUnreadChanged,
  onChanged
}: {
  query: string;
  setQuery: (query: string) => void;
  users: UserProfile[];
  tags: TagStat[];
  token: string;
  currentUser: string;
  memoUnread: HumanMemoUnreadSummary;
  memoRefreshSeq: number;
  onMemoUnreadChanged: () => void;
  onChanged: () => void;
}) {
  const [introCode, setIntroCode] = useState("");
  const [friends, setFriends] = useState<FriendBundle>({ friends: [], incoming: [], outgoing: [] });
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const filterOptions: Array<{ value: DirectoryFilter; label: string }> = [
    { value: "all", label: t("directoryFilterAll") },
    { value: "online", label: t("directoryFilterOnline") },
    { value: "friends", label: t("directoryFilterFriends") },
    { value: "agents", label: t("directoryFilterAgentVisible") },
    { value: "public", label: t("directoryFilterPublic") }
  ];
  const visibleUsers = users.filter((profile) => {
    if (filter === "online") return profile.online;
    if (filter === "friends") return profile.is_friend;
    if (filter === "agents") return profile.visibility === "agents" || profile.visibility === "public";
    if (filter === "public") return profile.visibility === "public" || profile.is_public;
    return true;
  });

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
      <div className="directoryFilters">
        <span>{t("directoryFilter")}</span>
        <div className="segmented">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={filter === option.value ? "active" : ""}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
        {visibleUsers.map((profile) => (
          <UserCard
            key={profile.email}
            profile={profile}
            token={token}
            currentUser={currentUser}
            memoUnreadCount={profile.email.toLowerCase() === currentUser.toLowerCase() ? memoUnread.total : 0}
            memoRefreshSeq={memoRefreshSeq}
            onAdd={(email) => createFriendRequest({ email })}
            onAccept={acceptFriend}
            onRemove={removeFriend}
            onMemoUnreadChanged={onMemoUnreadChanged}
            onChanged={onChanged}
          />
        ))}
        {visibleUsers.length === 0 && <Blank text={t("noHumans")} />}
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
            <span>{displayIdentity(profile)}</span>
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

function AgentsView({
  token,
  agents,
  setAgents
}: {
  token: string;
  agents: ConnectedAgent[];
  setAgents: (agents: ConnectedAgent[]) => void;
}) {
  async function reload() {
    await refreshAgents(token, setAgents);
  }

  return (
    <section className="page">
      <div className="pageTitle">
        <h2>{t("agents")}</h2>
        <button className="secondary" onClick={reload}>
          <RefreshCw size={16} /> {t("refresh")}
        </button>
      </div>
      <div className="gridList">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} token={token} onChanged={reload} />
        ))}
        {agents.length === 0 && <Blank text={t("noAgents")} />}
      </div>
    </section>
  );
}

function AgentCard({ agent, token, onChanged }: { agent: ConnectedAgent; token: string; onChanged: () => void }) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [score, setScore] = useState(5);
  const hasIncomingFriendRequest = agent.relation_status === "agent_requested";
  const isFriend = agent.relation_status === "friends";
  const unreadMessages = agent.pending_messages.filter((message) => !message.read_at);
  const ownerName = agent.owner_platform_name?.trim() || agent.owner_email;
  const ownerHome = /^[a-z0-9][a-z0-9-]{1,31}$/.test(ownerName) ? `/${encodeURIComponent(ownerName)}` : null;

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(apiPath(path), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || t("saveFailed"));
        return null;
      }
      await onChanged();
      return response;
    } finally {
      setBusy(false);
    }
  }

  async function requestFriend() {
    const response = await post(`/api/agents/${encodeURIComponent(agent.id)}/friend-request`, {
      body: draft.trim()
    });
    if (response) {
      setDraft("");
      setStatus(t("agentFriendRequested"));
    }
  }

  async function acceptFriend() {
    const response = await post(`/api/agents/${encodeURIComponent(agent.id)}/accept`);
    if (response) setStatus(t("agentFriendAccepted"));
  }

  async function sendAgentMemo() {
    const body = draft.trim();
    if (!body) return;
    const response = await post(`/api/agents/${encodeURIComponent(agent.id)}/ask-me`, {
      body
    });
    if (response) {
      setDraft("");
      setStatus(t("agentAskMeSent"));
    }
  }

  async function submitRating() {
    const response = await post(`/api/agents/${encodeURIComponent(agent.id)}/rate`, { score });
    if (response) {
      setRatingOpen(false);
      setStatus(t("ratingSubmitted"));
    }
  }

  return (
    <article className="userCard agentPanelCard">
      <div className="avatarCircle"><Bot size={22} /></div>
      <div className="userCardBody">
        <div className="userCardTitle">
          <strong>{agent.name || "MCP Agent"}</strong>
          <span className={agent.online ? "status onlineStatus" : "status"}>{agent.online ? t("onlineStatus") : t("offlineStatus")}</span>
        </div>
        <p>{agent.description || t("profileMissing")}</p>
        <div className="userMetaGrid">
          <span className="statusPill">
            {t("agentOwner")}: {ownerHome ? <a href={ownerHome}>{ownerName}</a> : ownerName}
          </span>
          <span className="statusPill">{t("agentLastTool")}: {agent.last_tool || "-"}</span>
          <span className="statusPill">{t("lastSeen")}: {formatTime(agent.last_seen_at)}</span>
        </div>
        <ReputationBadge
          score={agent.reputation}
          count={agent.ratings_count ?? 0}
          breakdown={agent.reputation_breakdown}
          compact
        />
        <div className="reviewBox">
          <strong>{t("agentCurrentTask")}</strong>
          <p>{agent.current_task || t("agentIdle")}</p>
        </div>
        {agent.pending_messages.length > 0 && (
          <div className="memoBoard">
            {unreadMessages.length > 0 && (
              <div className="memoBoardHead">
                <span className="unreadDot" />
                <strong>{t("unread")} {unreadMessages.length}</strong>
              </div>
            )}
            <div className="memoList">
            {agent.pending_messages.map((message) => (
              <article className={`memoItem ${message.read_at ? "" : "unread"}`} key={message.id}>
                <p>{message.body}</p>
                <small>
                  {message.kind === "friend_request" ? t("incomingAgentRequest") : message.kind}
                  {" · "}
                  {formatTime(message.created_at)}
                  {" · "}
                  {readStateText(message.read_at)}
                </small>
              </article>
            ))}
            </div>
          </div>
        )}
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("agentAskMePlaceholder")} />
        <div className="userCardActions">
          {hasIncomingFriendRequest && (
            <button className="secondary small" onClick={acceptFriend} disabled={busy}>
              <Check size={15} /> {t("acceptAgentFriend")}
            </button>
          )}
          {!isFriend && !hasIncomingFriendRequest && agent.relation_status !== "human_requested" && (
            <button className="secondary small" onClick={requestFriend} disabled={busy}>
              <UserPlus size={15} /> {t("requestAgentFriend")}
            </button>
          )}
          {agent.relation_status === "human_requested" && <span className="statusPill">{t("agentPending")}</span>}
          <button className="secondary small" onClick={() => setRatingOpen(!ratingOpen)} disabled={busy}>
            <Check size={15} /> {t("rateAgent")}
          </button>
          <button className="primary small" onClick={sendAgentMemo} disabled={busy || !draft.trim()}>
            <MessageSquareText size={15} /> {t("requestAgentAskMe")}
          </button>
        </div>
        {ratingOpen && (
          <div className="reviewBox">
            <label>
              <span>{t("rateAgent")} {score}/10</span>
              <input type="range" min="0" max="10" step="1" value={score} onChange={(event) => setScore(Number(event.target.value))} />
            </label>
            <button className="primary small" onClick={submitRating} disabled={busy}>
              <Check size={15} /> {t("submitRating")}
            </button>
          </div>
        )}
        {status && <div className={status.endsWith(".") || status.endsWith("。") ? "inlineStatus" : "notice warning"}>{status}</div>}
      </div>
    </article>
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
  const [selfProfile, setSelfProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    refresh();
  }, [token]);

  useEffect(() => {
    setPrefixDraft(settings?.agent_secret_prefix ?? "");
  }, [settings?.agent_secret_prefix]);

  useEffect(() => {
    if (access) setUserSecretDraft(access.user_agent_secret ?? "");
  }, [access?.user_agent_secret]);

  async function refresh() {
    const headers = authHeaders(token);
    const [data, profile] = await Promise.all([
      fetch(apiPath("/api/agent/access"), { headers }).then((response) => safeJson<AgentAccess>(response)),
      fetch(apiPath("/api/me/profile"), { headers }).then((response) => safeJson<UserProfile>(response))
    ]);
    if (data) setAccess(data);
    if (profile) setSelfProfile(profile);
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
    setStatus(t("savingAgent"));
    const next = {
      ...settings,
      agent_secret_prefix: prefixDraft.trim() || null
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
  const bearerLine = " -H " + shellQuote("Authorization: Bearer " + accessKey);
  const serverName = mcpServerName(access, selfProfile);
  const ownerName = agentOwnerName(access, selfProfile);
  const codexSecretEnv = mcpSecretEnvName(serverName);
  const installPrompt = agentInstallPrompt(mcpUrl, accessKey, {
    serverName,
    ownerName,
    profile: selfProfile?.profile ?? "",
    tags: selfProfile?.tags ?? [],
    visibility: access?.visibility ?? selfProfile?.visibility,
    introCode: access?.friend_code ?? access?.intro_code ?? selfProfile?.friend_code ?? selfProfile?.intro_code ?? "",
    directoryVisibility: access?.agent_directory_visibility,
    directoryMinReputation: access?.agent_directory_min_reputation
  });
  return (
    <section className="page agentPage">
      <div className="pageTitle">
        <div>
          <h2>{t("agentTitle")}</h2>
          <p>{t("agentSubtitle")}</p>
        </div>
        <button className="secondary" onClick={refresh}>
          <RefreshCw size={17} /> {t("update")}
        </button>
      </div>

      <div className="agentAccessGrid">
        <section className="panel agentCard">
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
            <span>MCP Server Name</span>
            <input value={serverName} readOnly onFocus={(event) => event.currentTarget.select()} />
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

        <section className="panel agentCard">
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
          <section className="panel agentCard">
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
          </section>
        )}
      </div>

      <section className="panel agentExamplesPanel">
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
            <h4>Codex CLI</h4>
            <pre>{`export ${codexSecretEnv}=${shellQuote(accessKey)}
codex mcp add ${serverName} --url ${shellQuote(mcpUrl)} --bearer-token-env-var ${codexSecretEnv}`}</pre>
          </section>
          <section>
            <h4>通用 MCP JSON（仅用于客户端导入或设置页）</h4>
            <pre>{JSON.stringify({
              mcpServers: {
                [serverName]: {
                  url: mcpUrl,
                  headers: {
                    Authorization: `Bearer ${accessKey}`
                  }
                }
              }
            }, null, 2)}</pre>
          </section>
          <section>
            <h4>curl 测试</h4>
            <pre>{`curl '${mcpUrl}' \\
  -H 'content-type: application/json' \\
 ${bearerLine} \\
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</pre>
          </section>
          <section>
            <h4>Codex / Claude / 其他 Agent 客户端</h4>
            <ol>
              <li>优先使用 Codex CLI、Claude CLI 或对应客户端自带的 MCP 添加命令 / 设置页。</li>
              <li>默认使用标准 Bearer 认证；Codex CLI 请使用 <code>--bearer-token-env-var</code>。</li>
              <li>新增一个名为 <code>{serverName}</code> 的 remote/http MCP server。</li>
              <li>URL 填上面的 MCP Endpoint。</li>
              <li>只有客户端无法配置 <code>Authorization: Bearer</code> 时，才使用兼容 header <code>x-humen-agent-secret</code>。</li>
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
  webhooks,
  users,
  currentUser,
  isAdmin,
  setSettings,
  setWebhooks
}: {
  token: string;
  settings: AdminSettings | null;
  webhooks: WebhookConfig[];
  users: UserProfile[];
  currentUser: string;
  isAdmin: boolean;
  setSettings: (settings: AdminSettings | null) => void;
  setWebhooks: (webhooks: WebhookConfig[]) => void;
}) {
  const [drafts, setDrafts] = useState<WebhookConfig[]>(() => webhooks);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(webhooks);
  }, [webhooks]);

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

  function addWebhook(kind: WebhookConfig["kind"] = isAdmin ? "generic" : "wechat") {
    const normalizedKind = isAdmin ? kind : "wechat";
    setDrafts((current) => [
      ...current,
      {
        id: randomId(),
        name: "",
        url: "",
        enabled: false,
        assigned_to: normalizedKind === "wechat" ? currentUser : "",
        secret: "",
        kind: normalizedKind,
        help_prompt: defaultWebhookHelpPrompt
      }
    ]);
  }

  function patchWebhook(index: number, patch: Partial<WebhookConfig>) {
    setDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function patchWebhookKind(index: number, kind: WebhookConfig["kind"]) {
    setDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, kind, assigned_to: kind === "wechat" ? currentUser : item.assigned_to ?? "" }
          : item
      )
    );
  }

  function syncSavedWebhooks(next: WebhookConfig[]) {
    setWebhooks(next);
    if (settings) setSettings({ ...settings, webhooks: next });
  }

  function replaceWebhook(updated: WebhookConfig) {
    setDrafts((current) => {
      const next = current.map((item) => (item.id === updated.id ? updated : item));
      syncSavedWebhooks(next);
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
    syncSavedWebhooks(saved);
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
          <p>微信连接固定绑定当前账号；管理员仍可维护 Generic webhook。</p>
        </div>
        <div className="rowActions">
          <button className="secondary" onClick={() => addWebhook("wechat")}>
            <Plus size={17} /> 微信扫码
          </button>
          {isAdmin && (
            <button className="secondary" onClick={() => addWebhook("generic")}>
              <Plus size={17} /> 新增 webhook
            </button>
          )}
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
              <p>Generic：ask_humen 创建消息时 POST 到目标 URL；微信：只同步当前账号收件箱的请求，并把该微信收到的消息放回同一收件箱。</p>
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
                  {isAdmin ? (
                    <select value={webhook.kind} onChange={(event) => patchWebhookKind(index, event.target.value)}>
                      <option value="generic">Generic webhook</option>
                      <option value="wechat">个人微信 IM（扫码登录）</option>
                    </select>
                  ) : (
                    <select value="wechat" disabled>
                      <option value="wechat">个人微信 IM（扫码登录）</option>
                    </select>
                  )}
                </label>
                <label>
                  <span>目标 URL（可选）</span>
                  <input value={webhook.url} onChange={(event) => patchWebhook(index, { url: event.target.value })} placeholder="https://example.com/webhook" />
                </label>
                <label>
                  <span>绑定收件箱用户</span>
                  {webhook.kind === "wechat" ? (
                    <input value={currentUser} disabled />
                  ) : (
                    <select value={webhook.assigned_to ?? ""} onChange={(event) => patchWebhook(index, { assigned_to: event.target.value })}>
                      <option value="">未指定（Generic 全局）</option>
                      {users.map((profile) => (
                        <option key={profile.email} value={profile.email}>
                          {displayIdentity(profile)} · {profile.email}
                        </option>
                      ))}
                    </select>
                  )}
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
        {drafts.length === 0 && <Blank text={isAdmin ? "点击上方按钮新增 webhook" : "点击“微信扫码”新增自己的微信连接"} />}
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
  users,
  reports,
  settings,
  setUsers,
  setSettings,
  setReports,
  onRefresh,
  refreshing
}: {
  token: string;
  users: UserProfile[];
  reports: HumanReport[];
  settings: AdminSettings;
  setUsers: (users: UserProfile[]) => void;
  setSettings: (settings: AdminSettings | null) => void;
  setReports: (reports: HumanReport[]) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [oauthProvider, setOauthProvider] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [oauthStatus, setOauthStatus] = useState<Record<string, string>>({});
  const [githubTokenDraft, setGithubTokenDraft] = useState("");
  const [updateStatus, setUpdateStatus] = useState<AdminUpdateStatus | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    refreshUpdateStatus();
  }, [token]);

  async function refreshUpdateStatus() {
    const response = await fetch(apiPath("/api/admin/update"), { headers: authHeaders(token) });
    const data = await safeJson<AdminUpdateStatus>(response);
    if (data) setUpdateStatus(data);
  }

  async function startSelfUpdate() {
    if (!window.confirm(t("confirmServerUpdate"))) return;
    setUpdateBusy(true);
    setUpdateMessage(t("updatingServer"));
    try {
      const response = await fetch(apiPath("/api/admin/update"), {
        method: "POST",
        headers: authHeaders(token)
      });
      if (!response.ok) {
        setUpdateMessage((await safeError(response)) || t("selfUpdateFailed"));
        await refreshUpdateStatus();
        return;
      }
      await safeJson<{ message?: string }>(response);
      setUpdateMessage(t("selfUpdateStarted"));
      await refreshUpdateStatus();
      window.setTimeout(() => {
        panelUpdateAvailable()
          .then((available) => {
            if (available) reloadPanel();
            else refreshUpdateStatus();
          })
          .catch(() => refreshUpdateStatus());
      }, 8000);
    } finally {
      setUpdateBusy(false);
    }
  }

  async function saveSettings(next: AdminSettings) {
    setSettingsStatus(t("saving"));
    setSettings(stripWriteOnlySettings(next));
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
      setSettings(stripWriteOnlySettings(mergeOAuthSecrets(await response.json(), next)));
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

  async function saveGithubApiToken() {
    const token = githubTokenDraft.trim();
    if (!token) return;
    const ok = await saveSettings({ ...settings, github_api_token: token });
    if (ok) {
      setSettings({ ...settings, github_api_token_configured: true });
      setGithubTokenDraft("");
    }
  }

  async function clearGithubApiToken() {
    const ok = await saveSettings({ ...settings, github_api_token: "" });
    if (ok) {
      setSettings({ ...settings, github_api_token_configured: false });
      setGithubTokenDraft("");
    }
  }

  return (
    <section className="page adminPage">
      <div className="pageTitle">
        <div>
          <h2>{t("security")}</h2>
          <p>{t("securitySubtitle")}</p>
        </div>
        <UpdatePanelControl onRefresh={onRefresh} refreshing={refreshing} />
      </div>

      <PasskeyPanel token={token} />
      {settingsStatus && <div className={settingsStatus === t("saved") ? "notice" : "notice warning"}>{settingsStatus}</div>}

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <KeyRound size={18} />
            <div>
              <h3>{t("githubApiToken")}</h3>
              <p>{t("githubApiTokenHelp")}</p>
            </div>
          </div>
          <span className={`githubTokenStatus ${settings.github_api_token_configured ? "configured" : ""}`}>
            {settings.github_api_token_configured ? t("githubApiTokenConfigured") : t("githubApiTokenMissing")}
          </span>
        </div>
        <div className="githubTokenGrid">
          <label>
            <span>{t("githubApiToken")}</span>
            <input
              type="password"
              value={githubTokenDraft}
              onChange={(event) => setGithubTokenDraft(event.target.value)}
              placeholder={t("githubApiTokenPlaceholder")}
              autoComplete="off"
            />
          </label>
          <button className="primary" onClick={saveGithubApiToken} disabled={!githubTokenDraft.trim()}>
            <Check size={16} /> {t("save")}
          </button>
          <button className="secondary" onClick={clearGithubApiToken} disabled={!settings.github_api_token_configured && !githubTokenDraft.trim()}>
            <Trash2 size={16} /> {t("clearToken")}
          </button>
        </div>
      </section>

      <AdminReportsPanel token={token} reports={reports} setReports={setReports} />

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

      <AgentDirectoryPolicyPanel settings={settings} onSave={saveSettings} />

      <section className="panel">
        <div className="panelHead">
          <div className="panelTitle">
            <RefreshCw size={18} />
            <div>
              <h3>{t("serverUpdate")}</h3>
              <p>{t("serverUpdateSubtitle")}</p>
            </div>
          </div>
          <button className="primary" onClick={startSelfUpdate} disabled={updateBusy || updateStatus?.running || !updateStatus?.enabled}>
            <RefreshCw size={16} className={updateBusy || updateStatus?.running ? "spin" : ""} /> {updateBusy || updateStatus?.running ? t("updatingServer") : t("startSelfUpdate")}
          </button>
        </div>
        <div className="metaRow updateMeta">
          <span>{t("serverVersion")} {updateStatus?.current_version ?? "unknown"}</span>
          <span>{updateStatus?.enabled ? t("selfUpdateEnabled") : t("selfUpdateDisabled")}</span>
          <FrontendVersion />
        </div>
        {updateMessage && <div className={updateMessage === t("updatingServer") || updateMessage === t("selfUpdateStarted") ? "notice" : "notice warning"}>{updateMessage}</div>}
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
            <AdminUserRow key={`${profile.provider}:${profile.email}`} profile={profile} token={token} afterChange={() => refreshAdmin(token, () => {}, setUsers, setSettings, setReports)} />
          ))}
        </div>
      </section>
    </section>
  );
}

function AgentDirectoryPolicyPanel({
  settings,
  onSave
}: {
  settings: AdminSettings;
  onSave: (settings: AdminSettings) => Promise<boolean>;
}) {
  const [visibility, setVisibility] = useState<AgentDirectoryVisibility>(() => normalizedAgentDirectoryVisibility(settings));
  const [minReputation, setMinReputation] = useState(() => String(normalizeReputationThreshold(settings.agent_directory_min_reputation)));

  useEffect(() => {
    setVisibility(normalizedAgentDirectoryVisibility(settings));
    setMinReputation(String(normalizeReputationThreshold(settings.agent_directory_min_reputation)));
  }, [settings.agent_directory_visibility, settings.agent_directory_min_reputation, settings.allow_agent_directory]);

  const selectedOption = agentDirectoryVisibilityOptions.find((option) => option.value === visibility) ?? agentDirectoryVisibilityOptions[0];

  async function savePolicy() {
    const threshold = normalizeReputationThreshold(Number(minReputation));
    setMinReputation(String(threshold));
    await onSave(withAgentDirectoryPolicy(settings, visibility, threshold));
  }

  return (
    <section className="panel agentDirectoryPolicy">
      <div className="panelHead">
        <div className="panelTitle">
          <Shield size={18} />
          <div>
            <h3>{t("agentDirectoryVisibility")}</h3>
            <p>{t("agentDirectoryVisibilityHelp")}</p>
          </div>
        </div>
        <button className="primary" onClick={savePolicy}>
          <Check size={16} /> {t("save")}
        </button>
      </div>

      <div className="settingsGrid agentPolicyGrid">
        <label>
          <span>{t("agentDirectoryMode")}</span>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as AgentDirectoryVisibility)}>
            {agentDirectoryVisibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        {visibility === "reputation_at_least" && (
          <label>
            <span>{t("agentDirectoryMinReputation")}</span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={minReputation}
              onChange={(event) => setMinReputation(event.target.value)}
            />
          </label>
        )}
      </div>

      <div className="agentPolicySummary">
        <Shield size={16} />
        <span>{t(selectedOption.helpKey)}</span>
      </div>
    </section>
  );
}

function AdminReportsPanel({ token, reports, setReports }: { token: string; reports: HumanReport[]; setReports: (reports: HumanReport[]) => void }) {
  async function refresh() {
    const response = await fetch(apiPath("/api/admin/reports"), { headers: authHeaders(token) });
    setReports((await safeJson<HumanReport[]>(response)) ?? []);
  }

  return (
    <section className="panel">
      <div className="panelHead">
        <div className="panelTitle">
          <Ban size={18} />
          <h3>{t("adminMailbox")}</h3>
        </div>
        <button className="secondary small" onClick={refresh}>
          <RefreshCw size={15} /> {t("update")}
        </button>
      </div>
      <div className="reportList">
        {reports.map((report) => (
          <article className="reportItem" key={report.id}>
            <div className="metaRow">
              <strong>{report.reported_email}</strong>
              <span>{formatTime(report.created_at)}</span>
              <span>{report.status}</span>
            </div>
            <p>{report.reason}</p>
            <small>{report.reporter_email}</small>
          </article>
        ))}
        {reports.length === 0 && <Blank text={t("noReports")} />}
      </div>
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
            <li>如果站点挂在子路径下，回调 URL 也必须包含对应子路径。</li>
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
  notice
}: {
  token: string;
  user: User;
  preferences: Preferences;
  setPreferences: (preferences: Preferences) => void;
  notice?: string;
}) {
  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("settingsSubtitle")}</p>
        </div>
        <FrontendVersion />
      </div>
      {notice && <div className="notice">{notice}</div>}
      <PersonalizationPanel user={user} preferences={preferences} setPreferences={setPreferences} />
      <ProfilePanel token={token} />
    </section>
  );
}

function SecurityView({
  token,
  user,
  notice
}: {
  token: string;
  user: User;
  notice?: string;
}) {
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [access, setAccess] = useState<AgentAccess | null>(null);
  const supported = passkeysSupported();

  useEffect(() => {
    fetch(apiPath("/api/auth/config"))
      .then((response) => safeJson<AuthConfig>(response))
      .then((config) => setAuthConfig(config ?? { github_enabled: false, allow_registration: false, oauth_channels: [] }))
      .catch(() => setAuthConfig({ github_enabled: false, allow_registration: false, oauth_channels: [] }));
    fetch(apiPath("/api/agent/access"), { headers: authHeaders(token) })
      .then((response) => safeJson<AgentAccess>(response))
      .then((data) => {
        if (data) setAccess(data);
      })
      .catch(() => {});
  }, [token]);

  const oauthChannels = authConfig?.oauth_channels ?? [];
  const enabledOauthChannels = oauthChannels.filter((channel) => channel.enabled);
  const oauthEnabled = Boolean(authConfig?.github_enabled || enabledOauthChannels.length > 0);
  const registrationOpen = authConfig?.allow_registration !== false;
  const oauthProviders = enabledOauthChannels.map((channel) => oauthProviderLabel(channel.provider));
  if (authConfig?.github_enabled && !oauthProviders.includes("GitHub")) oauthProviders.push("GitHub");
  const runtimeConfigItems = [
    `${t("providerLabel")}: ${user.provider}`,
    `${t("securityPasskeyStatus")}: ${authConfig?.passkey_enabled === false ? t("disabledStatus") : t("enabledStatus")} / ${supported ? t("availableStatus") : t("unavailableStatus")}`,
    `${t("securityOAuthStatus")}: ${oauthProviders.length > 0 ? oauthProviders.join(", ") : t("oauthDisabled")}`,
    `${t("securityRegistrationStatus")}: ${registrationOpen ? t("openStatus") : t("closedStatus")}`,
    `${t("securityAgentStatus")}: ${access?.secret_required === false ? t("disabledStatus") : t("enabledStatus")}`,
    `${t("agentDirectoryScope")}: ${agentDirectoryVisibilityLabel(access?.agent_directory_visibility ?? "self_only")}`,
    ...(access?.agent_directory_visibility === "reputation_at_least"
      ? [`${t("agentDirectoryMinReputation")}: ${access.agent_directory_min_reputation ?? 0}`]
      : [])
  ];

  return (
    <section className="page">
      <div className="pageTitle">
        <div>
          <h2>{t("security")}</h2>
          <p>{t("securitySubtitle")}</p>
        </div>
        <FrontendVersion />
      </div>
      {notice && <div className="notice">{notice}</div>}

      <section className="securitySummary">
        <SecurityStatusCard
          icon={<Shield size={18} />}
          title={t("securityCurrentSession")}
          status={access?.secret_required === false ? t("disabledStatus") : t("enabledStatus")}
          tone={access?.secret_required === false ? "warning" : "ok"}
          detail={`${user.email} · ${t("providerLabel")}: ${user.provider}`}
        />
        <SecurityStatusCard
          icon={<KeyRound size={18} />}
          title={t("securityPasskeyStatus")}
          status={supported && authConfig?.passkey_enabled !== false ? t("availableStatus") : t("unavailableStatus")}
          tone={supported && authConfig?.passkey_enabled !== false ? "ok" : "warning"}
          detail={supported ? t("passkeyReady") : t("passkeyNotReady")}
        />
        <SecurityStatusCard
          icon={<Github size={18} />}
          title={t("securityOAuthStatus")}
          status={oauthEnabled ? t("enabledStatus") : t("disabledStatus")}
          tone={oauthEnabled ? "ok" : "warning"}
          detail={oauthEnabled ? `${t("oauthEnabledCount")}: ${enabledOauthChannels.map((channel) => channel.provider).join(", ") || "github"}` : t("oauthDisabled")}
        />
        <SecurityStatusCard
          icon={<UserPlus size={18} />}
          title={t("securityRegistrationStatus")}
          status={registrationOpen ? t("openStatus") : t("closedStatus")}
          tone={registrationOpen ? "ok" : "neutral"}
          detail={t("adminPasswordPrivate")}
        />
      </section>

      <section className="panel securityConfigPanel">
        <div className="panelHead">
          <div className="panelTitle">
            <Shield size={18} />
            <h3>{t("securityRuntimeConfig")}</h3>
          </div>
        </div>
        <ul>
          {runtimeConfigItems.map((item) => (
            <li key={item}>
              <Check size={15} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <PasskeyPanel token={token} />
    </section>
  );
}

function SecurityStatusCard({
  icon,
  title,
  status,
  detail,
  tone
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  detail: string;
  tone: "ok" | "warning" | "neutral";
}) {
  return (
    <article className={`securityStatusCard ${tone}`}>
      <div className="securityStatusIcon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{status}</strong>
        <p>{detail}</p>
      </div>
    </article>
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
  const template = profileTemplate();
  const [profile, setProfile] = useState(template);
  const [tags, setTags] = useState("");
  const [introCode, setIntroCode] = useState("");
  const [visibility, setVisibility] = useState<ProfileVisibility>("private");
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(apiPath("/api/me/profile"), { headers: authHeaders(token) })
      .then((response) => safeJson<UserProfile>(response))
      .then((data) => {
        if (!data) return;
        setProfile(data.profile || template);
        setTags(data.tags.join(" "));
        setIntroCode(data.friend_code ?? data.intro_code ?? "");
        setVisibility(normalizedProfileVisibility(data));
        setOnboardingCompleted(Boolean(data.onboarding_completed));
      })
      .catch(() => {});
  }, [token, template]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus(t("savingProfile"));
    const response = await fetch(apiPath("/api/me/profile"), {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({
        profile,
        tags: splitTags(tags),
        visibility,
        is_public: visibility === "public",
        onboarding_completed: true
      })
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || t("saveProfileFailed"));
      return;
    }
    const data = await safeJson<UserProfile>(response);
    if (data) {
      setProfile(data.profile || template);
      setTags(data.tags.join(" "));
      setIntroCode(data.friend_code ?? data.intro_code ?? "");
      setVisibility(normalizedProfileVisibility(data));
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
        <label>
          <span>{t("profileVisibility")}</span>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as ProfileVisibility)}>
            {profileVisibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <small>{t(profileVisibilityOptions.find((option) => option.value === visibility)?.helpKey ?? "profileVisibilityPrivateHelp")}</small>
        </label>
        <label>
          <span>{t("profile")}</span>
          <textarea value={profile} onChange={(event) => setProfile(event.target.value)} placeholder={template} />
        </label>
        <label>
          <span>标签</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="#review #ops #qa" />
        </label>
        <div className="rowActions">
          <button className="secondary" type="button" onClick={() => setProfile(template)}>
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
          credential: publicKeyCredentialToJson(credential)
        })
      });
      if (!finish.ok) {
        setStatus((await safeError(finish)) || t("passkeyRegisterFailed"));
        return;
      }
      setPasskeys((await safeJson<PasskeyInfo[]>(finish)) ?? []);
      setStatus(t("passkeyAdded"));
    } catch (error) {
      setStatus(error instanceof Error ? `${t("passkeyRegisterFailed")}: ${error.message}` : t("passkeyRegisterFailed"));
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
        <button className="primary" onClick={addPasskey} disabled={busy || !supported}>
          <KeyRound size={17} /> {busy ? t("passkeyWaiting") : t("addPasskey")}
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
  token,
  currentUser,
  memoUnreadCount = 0,
  memoRefreshSeq = 0,
  onAdd,
  onAccept,
  onRemove,
  onMemoUnreadChanged,
  onChanged
}: {
  profile: UserProfile;
  token?: string;
  currentUser?: string;
  memoUnreadCount?: number;
  memoRefreshSeq?: number;
  onAdd?: (email: string) => void;
  onAccept?: (email: string) => void;
  onRemove?: (email: string) => void;
  onMemoUnreadChanged?: () => void;
  onChanged?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "report" | "memo">("idle");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [memos, setMemos] = useState<HumanMemo[]>([]);
  const [memoDraft, setMemoDraft] = useState("");
  const banned = profile.ban_expires_at && profile.ban_expires_at > Math.floor(Date.now() / 1000);
  const isSelf = currentUser ? profile.email.toLowerCase() === currentUser.toLowerCase() : false;
  const canReview = Boolean(token) && !isSelf;
  const githubUrl = githubProfileUrl(profile);
  const homePath = profileHomePath(profile);

  useEffect(() => {
    setMemos([]);
    setMemoDraft("");
    setMode("idle");
  }, [profile.email]);

  useEffect(() => {
    if (mode === "memo" && token) {
      void loadMemos();
    }
  }, [mode, token, profile.email]);

  useEffect(() => {
    if (mode === "memo" && token && isSelf && memoRefreshSeq > 0) {
      void loadMemos();
    }
  }, [mode, token, isSelf, memoRefreshSeq]);

  async function loadMemos() {
    if (!token) return;
    const response = await fetch(apiPath(`/api/humans/${encodeURIComponent(profile.email)}/memos`), {
      headers: authHeaders(token)
    });
    if (!response.ok) {
      setStatus((await safeError(response)) || t("saveFailed"));
      return;
    }
    setMemos((await safeJson<HumanMemo[]>(response)) ?? []);
    if (isSelf) onMemoUnreadChanged?.();
  }

  async function submitMemo() {
    if (!token || !memoDraft.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(apiPath(`/api/humans/${encodeURIComponent(profile.email)}/memos`), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: JSON.stringify({ body: memoDraft.trim() })
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || t("saveFailed"));
        return;
      }
      const memo = await safeJson<HumanMemo>(response);
      if (memo) setMemos((current) => [memo, ...current]);
      setMemoDraft("");
      if (isSelf) onMemoUnreadChanged?.();
      setStatus(t("memoSaved"));
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!token || !reason.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(apiPath("/api/humans/report"), {
        method: "POST",
        headers: { ...authHeaders(token), "content-type": "application/json" },
        body: JSON.stringify({ reported_email: profile.email, reason: reason.trim() })
      });
      if (!response.ok) {
        setStatus((await safeError(response)) || t("saveFailed"));
        return;
      }
      setReason("");
      setStatus(t("reportSubmitted"));
      setMode("idle");
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="userCard">
      <div className="avatarCircle">{initials(displayIdentity(profile))}</div>
      <div className="userCardBody">
        <div className="userCardTitle">
          <strong>{displayIdentity(profile)}</strong>
          {githubUrl && (
            <a className="secondary small githubProfileLink" href={githubUrl} target="_blank" rel="noreferrer">
              <Github size={15} /> {t("openGithubProfile")}
            </a>
          )}
        </div>
        <p>{profile.profile || t("profileMissing")}</p>
        <div className="userMetaGrid">
          <span className={profile.online ? "status onlineStatus" : "status"}>{profile.online ? t("onlineStatus") : t("offlineStatus")}</span>
          {homePath && <a className="statusPill" href={homePath}>@{profile.platform_name}</a>}
          <span className="statusPill">{profile.provider}</span>
          <span className="statusPill">{profileVisibilityLabel(profile.visibility ?? (profile.is_public ? "public" : "private"))}</span>
          <span className="statusPill">{t("lastSeen")}: {formatProfileLastSeen(profile)}</span>
          {banned && <span className="dangerText">banned until {formatTime(profile.ban_expires_at!)}</span>}
        </div>
        <ReputationBadge
          score={profile.reputation}
          count={profile.ratings_count ?? 0}
          breakdown={profile.reputation_breakdown}
          compact
        />
        {(profile.friend_code ?? profile.intro_code) && (
          <div className="introCodeLine">
            <span>{t("introCode")}</span>
            <code>{profile.friend_code ?? profile.intro_code}</code>
          </div>
        )}
        <div className="tagRow">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {(token || (!isSelf && (onAdd || onAccept || onRemove))) && (
          <div className="userCardActions">
            {!isSelf && profile.is_friend && onRemove && (
              <button className="secondary small" onClick={() => onRemove(profile.email)}>
                <Trash2 size={15} /> {t("removeFriend")}
              </button>
            )}
            {!isSelf && profile.friend_request_received && onAccept && (
              <button className="secondary small" onClick={() => onAccept(profile.email)}>
                <Check size={15} /> {t("acceptFriend")}
              </button>
            )}
            {!isSelf && profile.friend_request_sent && <span className="statusPill">{t("friendPending")}</span>}
            {!isSelf && !profile.is_friend && !profile.friend_request_received && !profile.friend_request_sent && profile.is_public && onAdd && (
              <button className="secondary small" onClick={() => onAdd(profile.email)}>
                <UserPlus size={15} /> {t("addFriend")}
              </button>
            )}
            {token && (
              <button className="secondary small" onClick={() => setMode(mode === "memo" ? "idle" : "memo")}>
                <MessageSquareText size={15} /> {t("memoBoard")}
                {memoUnreadCount > 0 && <span className="unreadDot" title={`${memoUnreadCount} ${t("unread")}`} />}
              </button>
            )}
            {canReview && (
              <button className="secondary small" onClick={() => setMode(mode === "report" ? "idle" : "report")}>
                <Ban size={15} /> {t("reportHuman")}
              </button>
            )}
          </div>
        )}
        {canReview && mode === "report" && (
          <div className="reviewBox">
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("reportReason")} />
            <button className="primary small" onClick={submitReport} disabled={busy || !reason.trim()}>
              <Ban size={15} /> {t("submitReport")}
            </button>
          </div>
        )}
        {token && mode === "memo" && (
          <div className="reviewBox memoBoard">
            <div className="memoList">
              {memos.map((memo) => (
                <article className={`memoItem ${!memo.read_at && memo.author_email.toLowerCase() !== (currentUser ?? "").toLowerCase() ? "unread" : ""}`} key={memo.id}>
                  <p>{memo.body}</p>
                  <small>
                    {displayMemoAuthor(memo)}
                    {" · "}
                    {formatTime(memo.created_at)}
                    {" · "}
                    {readStateText(memo.read_at)}
                  </small>
                </article>
              ))}
              {memos.length === 0 && <small>{t("noMemos")}</small>}
            </div>
            <textarea value={memoDraft} onChange={(event) => setMemoDraft(event.target.value)} placeholder={t("memoPlaceholder")} />
            <button className="primary small" onClick={submitMemo} disabled={busy || !memoDraft.trim()}>
              <MessageSquareText size={15} /> {t("sendMemo")}
            </button>
          </div>
        )}
        {status && <div className={status.endsWith(".") || status.endsWith("。") ? "inlineStatus" : "notice warning"}>{status}</div>}
      </div>
    </article>
  );
}

function displayMemoAuthor(memo: HumanMemo | string): string {
  if (typeof memo !== "string" && memo.author_agent_name) {
    return `${memo.author_agent_name} (${displayMemoAuthorEmail(memo.author_email)})`;
  }
  const email = typeof memo === "string" ? memo : memo.author_email;
  return displayMemoAuthorEmail(email);
}

function displayMemoAuthorEmail(email: string): string {
  if (email.startsWith("github:")) return email.replace(/^github:/, "GitHub ");
  return email;
}

function readStateText(readAt?: number | null) {
  return readAt ? `${t("read")} ${formatTime(readAt)}` : t("unread");
}

function formatProfileLastSeen(profile: UserProfile) {
  const lastSeen = profile.last_seen_at ?? profile.last_login_at;
  return lastSeen ? formatTime(lastSeen) : "-";
}

function ReputationBadge({
  score,
  count,
  breakdown,
  compact = false
}: {
  score: number;
  count: number;
  breakdown?: ReputationBreakdown | null;
  compact?: boolean;
}) {
  const seedSource = breakdown?.seed_source;
  const totalWeight = breakdown?.total_weight ?? 0;
  const hasEvidence = totalWeight > 0 || count > 0;
  const seedLabel = seedSource === "github"
    ? t("reputationSeedGithub")
    : seedSource || (hasEvidence ? t("reputationSeedNone") : t("reputationDefault"));
  const confidence = breakdown?.confidence ?? 0;
  const title = [
    t("reputationWeightedHelp"),
    `${t("reputationEvidence")}: ${formatWeight(totalWeight)}`,
    `${t("reputationConfidence")}: ${formatPercent(confidence)}`
  ].join("\n");

  return (
    <span className={`reputationBadge ${compact ? "compact" : ""}`} title={title}>
      <strong>{formatScore(score)}</strong>
      <span className="reputationDetails">
        {hasEvidence
          ? `${t("reputation")} · ${t("ratingsCount")} ${count} · ${seedLabel}`
          : t("reputationDefault")}
      </span>
      {!compact && (
        <span className="reputationDetails">
          {t("reputationEvidence")} {formatWeight(totalWeight)} · {t("reputationConfidence")} {formatPercent(confidence)}
        </span>
      )}
    </span>
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

function authHeaders(token: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function passkeysSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

function decodeCredentialCreationOptions(payload: PublicKeyCredentialCreationOptionsPayload): CredentialCreationOptions {
  const options = unwrapPublicKeyOptions(payload);
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

function decodeCredentialRequestOptions(payload: PublicKeyCredentialRequestOptionsPayload): CredentialRequestOptions {
  const options = unwrapPublicKeyOptions(payload);
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

function unwrapPublicKeyOptions<T>(payload: T | { publicKey: T }): T {
  if (typeof payload === "object" && payload !== null && "publicKey" in payload) {
    return (payload as { publicKey: T }).publicKey;
  }
  return payload as T;
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
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid passkey challenge from server");
  }
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

async function refreshLeaderboard(token: string, setLeaderboard: (entries: HumanLeaderboardEntry[]) => void) {
  const response = await fetch(apiPath("/api/stats/leaderboard"), { headers: authHeaders(token) });
  const data = await safeJson<HumanLeaderboardEntry[]>(response);
  setLeaderboard(data ?? []);
}

async function refreshTrash(token: string, setTrash: (trash: ExpiredRequest[]) => void) {
  const response = await fetch(apiPath("/api/trash"), { headers: authHeaders(token) });
  const data = await safeJson<ExpiredRequest[]>(response);
  setTrash(data ? sortTrash(data) : []);
}

async function hideRequest(token: string, id: string) {
  const response = await fetch(apiPath(`/api/requests/${encodeURIComponent(id)}/hide`), {
    method: "POST",
    headers: authHeaders(token)
  });
  return response.ok;
}

async function refreshAgents(token: string, setAgents: (agents: ConnectedAgent[]) => void) {
  const response = await fetch(apiPath("/api/agents"), { headers: authHeaders(token) });
  const data = await safeJson<ConnectedAgent[]>(response);
  setAgents(data ?? []);
}

async function refreshMemoUnread(token: string, setMemoUnread: (summary: HumanMemoUnreadSummary) => void) {
  const response = await fetch(apiPath("/api/memos/unread"), { headers: authHeaders(token) });
  const data = await safeJson<HumanMemoUnreadSummary>(response);
  setMemoUnread(data ?? { total: 0, sources: [] });
}

async function refreshWebhooks(token: string, setWebhooks: (webhooks: WebhookConfig[]) => void) {
  const response = await fetch(apiPath("/api/admin/webhooks"), { headers: authHeaders(token) });
  const data = await safeJson<WebhookConfig[]>(response);
  setWebhooks(data ?? []);
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

async function refreshAdmin(
  token: string,
  setIsAdmin: (isAdmin: boolean) => void,
  setUsers: (users: UserProfile[]) => void,
  setSettings: (settings: AdminSettings | null) => void,
  setReports: (reports: HumanReport[]) => void = () => {}
) {
  const [users, settings, reports] = await Promise.all([
    fetch(apiPath("/api/admin/users"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/admin/settings"), { headers: authHeaders(token) }),
    fetch(apiPath("/api/admin/reports"), { headers: authHeaders(token) })
  ]);
  const usersData = await safeJson<UserProfile[]>(users);
  const settingsData = await safeJson<AdminSettings>(settings);
  const reportsData = await safeJson<HumanReport[]>(reports);
  if (usersData && settingsData) {
    setIsAdmin(true);
    setUsers(usersData);
    setSettings(settingsData);
    setReports(reportsData ?? []);
  } else {
    setIsAdmin(false);
    setUsers([]);
    setSettings(null);
    setReports([]);
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
  return displayIdentity({ email }).slice(0, 2).toUpperCase();
}

function avatarText(user: User, preferences: Preferences) {
  return (preferences.avatarText.trim() || initials(user.email)).slice(0, 4).toUpperCase();
}

function displayIdentity(profile: Pick<UserProfile, "email" | "login" | "platform_name"> | Pick<User, "email">) {
  if ("platform_name" in profile && profile.platform_name) return profile.platform_name;
  if ("login" in profile && profile.login) return profile.login;
  if (profile.email.startsWith("github:")) return profile.email.replace(/^github:/, "GitHub ");
  return profile.email;
}

function githubProfileUrl(profile: Pick<UserProfile, "provider" | "login">) {
  if (profile.provider !== "github" || !profile.login) return null;
  const login = profile.login.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)) return null;
  return `https://github.com/${login}`;
}

function profileHomePath(profile: Pick<UserProfile, "platform_name">) {
  const slug = profile.platform_name?.trim();
  if (!slug) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(slug)) return null;
  return `/${encodeURIComponent(slug)}`;
}

function publicProfileSlug() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (!path || path === "/" || path === "/mcp") return null;
  if (path.startsWith("/mcp/")) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  return decodeURIComponent(parts[0]);
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

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

type AgentInstallPromptContext = {
  serverName: string;
  ownerName: string;
  profile: string;
  tags: string[];
  visibility?: ProfileVisibility;
  introCode?: string;
  directoryVisibility?: AgentDirectoryVisibility;
  directoryMinReputation?: number;
};

function agentOwnerName(access: AgentAccess | null, profile: UserProfile | null) {
  if (profile) return displayIdentity(profile);
  return identityNameBase(access?.user ?? "humen");
}

function mcpServerName(access: AgentAccess | null, profile: UserProfile | null) {
  const baseName = profile?.login?.trim() || identityNameBase(profile?.email ?? access?.user ?? "humen");
  const slug = baseName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "humen"}-human-mcp`;
}

function identityNameBase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "humen";
  const withoutProvider = trimmed.replace(/^github:/i, "");
  const atIndex = withoutProvider.indexOf("@");
  return atIndex > 0 ? withoutProvider.slice(0, atIndex) : withoutProvider;
}

function mcpSecretEnvName(serverName: string) {
  const prefix = serverName
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `${prefix || "HUMEN_MCP"}_SECRET`;
}

function agentDirectoryScopeText(context: AgentInstallPromptContext) {
  const minReputation = context.directoryMinReputation ?? 0;
  switch (context.directoryVisibility) {
    case "self_only":
      return "当前策略只允许看到 secret 绑定用户。";
    case "self_and_friends":
      return "当前策略允许看到 secret 绑定用户和该用户的好友。";
    case "reputation_at_least":
      return `当前策略允许看到 secret 绑定用户，以及信誉不低于 ${minReputation} 的公开/Agent 可见用户。`;
    case "public_users":
      return "当前策略允许看到 secret 绑定用户，以及公开/Agent 可见用户。";
    default:
      return "可见范围由服务器策略控制，通常包含 secret 绑定用户、该用户好友，以及公开/Agent 可见用户。";
  }
}

function agentInstallPrompt(mcpUrl: string, accessKey: string, context: AgentInstallPromptContext) {
  const codexSecretEnv = mcpSecretEnvName(context.serverName);
  const secretLine = "认证信息：Agent Secret = " + accessKey;
  const profile = context.profile.trim() || "用户暂无简介。";
  const tags = context.tags.length > 0 ? context.tags.join(" ") : "暂无标签";
  const visibility = context.visibility ? profileVisibilityLabel(context.visibility) : "未知";
  const introCode = context.introCode?.trim() || "未设置";
  const importJson = JSON.stringify({
    mcpServers: {
      [context.serverName]: {
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${accessKey}`
        }
      }
    }
  }, null, 2);

  return `请帮我把 ${context.serverName} 配置成一个 remote/http MCP server。

请先判断你当前使用的是哪种 Agent 工具或客户端，并使用它自带的 MCP 添加方式：

- 如果是 Codex CLI，请使用 Codex CLI 的 MCP 添加命令（不确定参数时先运行 codex mcp --help / codex mcp add --help）。
- 如果是 Claude Code / Claude CLI，请使用 Claude CLI 的 MCP 添加命令（不确定参数时先运行 claude mcp --help / claude mcp add --help）。
- 如果是其他编程 CLI 工具或 Agent 客户端，请使用该工具自带的 MCP 添加命令、设置页或导入功能。

如果当前是 CLI 工具，必须通过命令行添加 MCP server；不要直接编辑配置文件（例如 settings.json、config.toml、claude_desktop_config.json 等）来添加。

名称：${context.serverName}
MCP URL：${mcpUrl}
${secretLine}

这个 Agent Secret 绑定到用户：${context.ownerName}
用户简介：
${profile}
标签：${tags}
可见性：${visibility}
好友/介绍码：${introCode}

使用边界：
- 这是一个用户一个 secret 的 MCP 接入，不是全局匿名入口。
- 默认的 ask_humen / approve / judge / feedback / create_humen_task 会把请求发给 secret 绑定用户：${context.ownerName}。
- 也可以通过这个 MCP server 调用用户目录能力：list_online_humens、search_humen_profiles、list_humen_tags，用来发现和读取当前 secret 按策略可见的用户，包括绑定用户、用户朋友或公开/Agent 可见用户。
- ${agentDirectoryScopeText(context)}
- 如果要找朋友或公开用户，先用 search_humen_profiles 按姓名、简介或 #tag 搜索，再根据返回的 profile、reputation、online 状态决定是否继续。

请优先使用标准 Bearer 认证。Codex CLI 使用 bearer token 环境变量：

export ${codexSecretEnv}=${shellQuote(accessKey)}
codex mcp add ${context.serverName} --url ${shellQuote(mcpUrl)} --bearer-token-env-var ${codexSecretEnv}

如果已存在同名 ${context.serverName} 配置，请先用 Codex CLI 命令移除旧配置：

codex mcp remove ${context.serverName}

如果客户端只能通过 mcpServers JSON 导入或设置页添加，请使用下面内容；不要因为这个示例去手动编辑配置文件：

${importJson}

只有客户端无法配置 Authorization: Bearer 时，才使用兼容 header：x-humen-agent-secret = ${accessKey}

配置后请重启/刷新 MCP 连接，并执行 tools/list 验证能看到 approve、judge、feedback、ask_humen、ask_humen_async、ask_humen_text_async、ask_humen_choice_async、ask_humen_judgment_async、read_humen_replies、create_humen_task、leave_humen_memo、list_humen_tasks、list_agent_inbox、request_human_friend、accept_human_friend、list_online_humens、search_humen_profiles、list_humen_tags、rate_humen、report_humen。`;
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

function profileVisibilityLabel(visibility: ProfileVisibility) {
  const option = profileVisibilityOptions.find((item) => item.value === visibility) ?? profileVisibilityOptions[0];
  return t(option.labelKey);
}

function agentDirectoryVisibilityLabel(visibility: AgentDirectoryVisibility) {
  const option = agentDirectoryVisibilityOptions.find((item) => item.value === visibility) ?? agentDirectoryVisibilityOptions[0];
  return t(option.labelKey);
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

function stripWriteOnlySettings(settings: AdminSettings): AdminSettings {
  const { github_api_token: _githubApiToken, ...rest } = settings;
  return rest;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatScore(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value ?? 5);
}

function formatWeight(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 }).format(value ?? 0);
}

function logout(
  setToken: (token: string) => void,
  setUser: (user: User | null) => void,
  setRequests: (requests: HumanRequest[]) => void,
  setTasks: (tasks: AgentTask[]) => void,
  setSent: (sent: AnsweredRequest[]) => void,
  setTrash: (trash: ExpiredRequest[]) => void,
  setWebhooks: (webhooks: WebhookConfig[]) => void
) {
  void fetch(apiPath("/api/auth/logout"), {
    method: "POST",
    headers: authHeaders(localStorage.getItem(tokenKey) ?? "")
  }).catch(() => {});
  localStorage.removeItem(tokenKey);
  setToken("");
  setUser(null);
  setRequests([]);
  setTasks([]);
  setSent([]);
  setTrash([]);
  setWebhooks([]);
}

function Root() {
  const [preferences, setPreferences] = usePreferences();

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.compact = preferences.compact ? "true" : "false";
    document.documentElement.lang = preferences.language;
  }, [preferences.theme, preferences.compact, preferences.language]);

  return (
    <MantineProvider theme={theme} forceColorScheme={preferences.theme}>
      <App preferences={preferences} setPreferences={setPreferences} />
    </MantineProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
