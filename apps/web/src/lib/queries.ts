import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  QueryClient,
} from '@tanstack/react-query';
import {
  SOCKET_EVENTS,
  type ActivityEventDTO,
  type Project,
  type SaleProgressEvent,
} from '@apogee/shared';
import { api, type ProjectFilters } from './api';
import { getSocket } from './socket';
import { useSession } from '../state/store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/* ── Reads ────────────────────────────────────────────────────────── */

export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: ['projects', filters.status ?? 'all', filters.chain ?? 'all'],
    queryFn: () => api.projects(filters).then((r) => r.projects),
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: ['project', slug],
    queryFn: () => api.project(slug!).then((r) => r.project),
    enabled: !!slug,
  });
}

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: () => api.stats().then((r) => r.stats) });
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => api.activity().then((r) => r.events),
  });
}

export function usePortfolio(wallet: string | null) {
  return useQuery({
    queryKey: ['portfolio', wallet],
    queryFn: () => api.portfolio(wallet!),
    enabled: !!wallet,
  });
}

/* ── Mutations ────────────────────────────────────────────────────── */

export function useParticipate(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountUsd: number) => api.participate(slug, amountUsd),
    onSuccess: (res) => {
      useSession.getState().setAccount(res.account);
      applySaleProgress(qc, res.sale);
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useStake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, direction }: { amount: number; direction: 'stake' | 'unstake' }) =>
      direction === 'stake' ? api.stake(amount) : api.unstake(amount),
    onSuccess: (res) => {
      useSession.getState().setAccount(res.account);
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (positionId: string) => api.claim(positionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

/* ── Realtime: socket → query cache ───────────────────────────────── */

function applySaleProgress(qc: QueryClient, ev: SaleProgressEvent) {
  qc.setQueryData<Project>(['project', ev.slug], (old) =>
    old ? { ...old, raised: ev.raised, participants: ev.participants } : old,
  );
  qc.setQueriesData<Project[]>({ queryKey: ['projects'] }, (old) =>
    old?.map((p) => (p.slug === ev.slug ? { ...p, raised: ev.raised, participants: ev.participants } : p)),
  );
}

/**
 * Mount once at app root: streams socket events into the query cache so
 * every open view (and every open tab) updates without refetching.
 */
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();

    const onActivity = (ev: ActivityEventDTO) => {
      qc.setQueryData<ActivityEventDTO[]>(['activity'], (old) =>
        [ev, ...(old ?? [])].slice(0, 20),
      );
    };
    const onProgress = (ev: SaleProgressEvent) => {
      applySaleProgress(qc, ev);
      qc.invalidateQueries({ queryKey: ['stats'] });
    };

    socket.on(SOCKET_EVENTS.activityNew, onActivity);
    socket.on(SOCKET_EVENTS.saleProgress, onProgress);
    return () => {
      socket.off(SOCKET_EVENTS.activityNew, onActivity);
      socket.off(SOCKET_EVENTS.saleProgress, onProgress);
    };
  }, [qc]);
}
