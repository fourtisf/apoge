import type {
  Account,
  ActivityEventDTO,
  AnnouncementDTO,
  ApplicationDTO,
  Chain,
  ChainType,
  LeaderboardDTO,
  PortfolioSummary,
  PositionDTO,
  Project,
  StatsDTO,
  StatsDetailDTO,
} from '@apogee/shared';
import { useSession } from '../state/store';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? useSession.getState().token;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    // A 401 on a *user* call invalidates the wallet session. Admin calls
    // (tokenOverride) manage their own token lifecycle.
    if (res.status === 401 && tokenOverride === undefined) useSession.getState().clear();
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export interface ProjectFilters {
  status?: string;
  chain?: string;
}

export const api = {
  projects: (f: ProjectFilters = {}) => {
    const q = new URLSearchParams();
    if (f.status) q.set('status', f.status);
    if (f.chain) q.set('chain', f.chain);
    const qs = q.toString();
    return get<{ projects: Project[] }>(`/projects${qs ? `?${qs}` : ''}`);
  },
  project: (slug: string) => get<{ project: Project }>(`/projects/${slug}`),
  stats: () => get<{ stats: StatsDTO }>('/stats'),
  statsDetail: () => get<{ detail: StatsDetailDTO }>('/stats/detail'),
  leaderboard: () => get<LeaderboardDTO>('/leaderboard'),
  news: () => get<{ announcements: AnnouncementDTO[] }>('/news'),
  activity: () => get<{ events: ActivityEventDTO[] }>('/activity'),
  account: (wallet: string) => get<{ account: Account }>(`/account/${wallet}`),
  portfolio: (wallet: string) =>
    get<{ positions: PositionDTO[]; summary: PortfolioSummary }>(`/portfolio/${wallet}`),

  nonce: (wallet: string, chainType: ChainType) =>
    get<{ nonce: string; message: string }>(
      `/auth/nonce?wallet=${encodeURIComponent(wallet)}&chainType=${chainType}`,
    ),
  verify: (wallet: string, chainType: ChainType, signature: string) =>
    post<{ token: string; account: Account }>('/auth/verify', { wallet, chainType, signature }),

  participate: (slug: string, amountUsd: number) =>
    post<{ position: PositionDTO; account: Account; sale: { slug: string; raised: number; participants: number } }>(
      `/sales/${slug}/participate`,
      { amountUsd },
    ),
  stake: (amount: number) => post<{ account: Account }>('/staking/stake', { amount }),
  unstake: (amount: number) => post<{ account: Account }>('/staking/unstake', { amount }),
  claim: (positionId: string) =>
    post<{ position: PositionDTO; claimedTokens: number }>(`/positions/${positionId}/claim`),

  apply: (input: {
    projectName: string;
    ticker: string;
    chain: Chain;
    website: string;
    contactEmail: string;
    pitch: string;
    raiseTarget: number;
    x?: string;
    telegram?: string;
    logoUrl?: string;
    devHandle?: string;
    devEmail?: string;
  }) => post<{ application: ApplicationDTO }>('/apply', input),
};

/** Everything a project row needs when sent to the admin CRUD endpoints. */
export type AdminProjectInput = Omit<Project, 'raised' | 'participants'> & {
  raised: number;
  participants: number;
};

export const adminApi = {
  login: (password: string) => post<{ token: string }>('/admin/login', { password }),
  projects: (token: string) =>
    request<{ projects: Project[] }>('/admin/projects', undefined, token),
  createProject: (token: string, input: AdminProjectInput) =>
    request<{ project: Project }>(
      '/admin/projects',
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),
  updateProject: (token: string, slug: string, input: AdminProjectInput) =>
    request<{ project: Project }>(
      `/admin/projects/${slug}`,
      { method: 'PUT', body: JSON.stringify(input) },
      token,
    ),
  deleteProject: (token: string, slug: string) =>
    request<{ deleted: string }>(`/admin/projects/${slug}`, { method: 'DELETE' }, token),
  applications: (token: string) =>
    request<{ applications: ApplicationDTO[] }>('/admin/applications', undefined, token),
  setApplicationStatus: (token: string, id: string, status: ApplicationDTO['status']) =>
    request<{ application: ApplicationDTO }>(
      `/admin/applications/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      token,
    ),
  createNews: (token: string, input: { title: string; body: string; tag: AnnouncementDTO['tag'] }) =>
    request<{ announcement: AnnouncementDTO }>(
      '/admin/news',
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),
  deleteNews: (token: string, id: string) =>
    request<{ deleted: string }>(`/admin/news/${id}`, { method: 'DELETE' }, token),
};
