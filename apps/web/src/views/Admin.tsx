import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CHAIN_META,
  fmtUsdCompact,
  ONCHAIN_CHAINS,
  type ApplicationDTO,
  type ApplicationStatus,
  type Chain,
  type Project,
  type ProjectStatus,
  type SettlementMode,
} from '@apogee/shared';
import { IconCheck, IconRocket, IconX } from '../components/icons';
import { ChainPill, LogoTile, Skeleton, StatusPill } from '../components/ui';
import { adminApi, ApiError, type AdminProjectInput } from '../lib/api';
import { timeAgo } from '../lib/time';
import { toast } from '../state/store';

/* ── Admin session (separate from the wallet session) ─────────────── */

interface AdminState {
  adminToken: string | null;
  setToken: (t: string | null) => void;
}

const useAdmin = create<AdminState>()(
  persist((set) => ({ adminToken: null, setToken: (adminToken) => set({ adminToken }) }), {
    name: 'apogee-admin',
  }),
);

/* ── Helpers ──────────────────────────────────────────────────────── */

const BLANK: AdminProjectInput = {
  slug: '',
  name: '',
  ticker: '',
  chain: 'SOL',
  sector: 'DeFi',
  status: 'upcoming',
  description: '',
  about: '',
  highlights: [],
  logo: { letter: 'A', from: '#EAD1A2', to: '#C9A366' },
  contract: null,
  socials: {},
  tokenomics: [
    { label: 'Public Sale', pct: 15 },
    { label: 'Ecosystem', pct: 35 },
    { label: 'Team', pct: 20 },
    { label: 'Treasury', pct: 30 },
  ],
  vesting: { tgePct: 20, cliffMonths: 1, linearMonths: 6 },
  supply: 1_000_000_000,
  initMcap: 5_000_000,
  fdv: 40_000_000,
  listing: 'DEX · T+2 days',
  softCap: 200_000,
  hardCap: 600_000,
  price: 0.04,
  startAt: null,
  endAt: null,
  raised: 0,
  participants: 0,
  audited: false,
  kycTeam: false,
  settlement: 'offchain',
};

function toInput(p: Project): AdminProjectInput {
  return { ...p, raised: p.raised, participants: p.participants };
}

/** Seed a new project draft from an accepted application. */
function appToProjectInput(a: ApplicationDTO): AdminProjectInput {
  const slug =
    a.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'new-launch';
  return {
    ...BLANK,
    name: a.projectName,
    ticker: a.ticker.toUpperCase(),
    chain: a.chain,
    slug,
    description: a.pitch.slice(0, 300),
    about: a.pitch.slice(0, 2000),
    softCap: a.raiseTarget > 0 ? Math.max(1, Math.round(a.raiseTarget * 0.3)) : BLANK.softCap,
    hardCap: a.raiseTarget > 0 ? a.raiseTarget : BLANK.hardCap,
    socials: { website: a.website, ...(a.x ? { x: a.x } : {}) },
    logo: { ...BLANK.logo, letter: (a.ticker[0] ?? a.projectName[0] ?? 'A').toUpperCase() },
  };
}

/** ISO ↔ <input type="datetime-local"> (local time, minute precision). */
function isoToLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function localToIso(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Request failed';
}

/* ── Field primitives ─────────────────────────────────────────────── */

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-line-strong bg-panel2 px-3 py-2 text-[13px] text-ivory outline-none transition-colors focus:border-gold/50';

/* ── Login ────────────────────────────────────────────────────────── */

function AdminLogin() {
  const setToken = useAdmin((s) => s.setToken);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await adminApi.login(password);
      setToken(token);
      toast.success('Admin session started');
    } catch (err) {
      toast.error('Login failed', errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel mx-auto mt-16 flex max-w-sm flex-col gap-4 p-8">
      <div>
        <h1 className="text-[17px] font-semibold text-ivory">Admin</h1>
        <p className="mt-1 text-[12px] text-muted">Restricted area — operator access only.</p>
      </div>
      <input
        type="password"
        className={inputCls}
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <button className="btn btn-gold" disabled={busy || !password}>
        {busy ? <span className="spinner" /> : 'Sign in'}
      </button>
    </form>
  );
}

/* ── Project editor ───────────────────────────────────────────────── */

function ProjectEditor({
  initial,
  existingSlug,
  onClose,
}: {
  initial: AdminProjectInput;
  existingSlug: string | null;
  onClose: () => void;
}) {
  const token = useAdmin((s) => s.adminToken)!;
  const qc = useQueryClient();
  const [p, setP] = useState<AdminProjectInput>(initial);
  const set = <K extends keyof AdminProjectInput>(key: K, value: AdminProjectInput[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      existingSlug ? adminApi.updateProject(token, existingSlug, p) : adminApi.createProject(token, p),
    onSuccess: () => {
      toast.success(existingSlug ? 'Project updated' : 'Project created');
      qc.invalidateQueries({ queryKey: ['admin-projects'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (err) => toast.error('Save failed', errMsg(err)),
  });

  const del = useMutation({
    mutationFn: () => adminApi.deleteProject(token, existingSlug!),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['admin-projects'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err) => toast.error('Delete failed', errMsg(err)),
  });

  const tokenomicsSum = p.tokenomics.reduce((s, t) => s + t.pct, 0);
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <section className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ivory">
          {existingSlug ? `Edit · ${initial.name}` : 'New project'}
        </h2>
        <button onClick={onClose} className="text-faint hover:text-ivory" aria-label="Close editor">
          <IconX size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Field label="Name">
          <input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Slug (URL)">
          <input
            className={inputCls}
            value={p.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          />
        </Field>
        <Field label="Ticker">
          <input className={inputCls} value={p.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Sector">
          <input className={inputCls} value={p.sector} onChange={(e) => set('sector', e.target.value)} />
        </Field>
        <Field label="Chain">
          <select className={inputCls} value={p.chain} onChange={(e) => set('chain', e.target.value as Chain)}>
            {(Object.keys(CHAIN_META) as Chain[]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={p.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            {(['live', 'upcoming', 'tba', 'ended'] as const).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="One-line description" wide>
          <input className={inputCls} value={p.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="About (overview tab)" wide>
          <textarea className={`${inputCls} min-h-[90px]`} value={p.about} onChange={(e) => set('about', e.target.value)} />
        </Field>
        <Field label="Highlights (one per line)" wide>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={p.highlights.join('\n')}
            onChange={(e) => set('highlights', e.target.value.split('\n').filter((l) => l.trim()))}
          />
        </Field>

        <Field label="Price (USD)">
          <input type="number" step="any" className={inputCls} value={p.price} onChange={(e) => set('price', num(e.target.value))} />
        </Field>
        <Field label="Total supply">
          <input type="number" className={inputCls} value={p.supply} onChange={(e) => set('supply', num(e.target.value))} />
        </Field>
        <Field label="Soft cap (USD)">
          <input type="number" className={inputCls} value={p.softCap} onChange={(e) => set('softCap', num(e.target.value))} />
        </Field>
        <Field label="Hard cap (USD)">
          <input type="number" className={inputCls} value={p.hardCap} onChange={(e) => set('hardCap', num(e.target.value))} />
        </Field>
        <Field label="Initial mcap (USD)">
          <input type="number" className={inputCls} value={p.initMcap} onChange={(e) => set('initMcap', num(e.target.value))} />
        </Field>
        <Field label="FDV (USD)">
          <input type="number" className={inputCls} value={p.fdv} onChange={(e) => set('fdv', num(e.target.value))} />
        </Field>
        <Field label="Raised (USD)">
          <input type="number" className={inputCls} value={p.raised} onChange={(e) => set('raised', num(e.target.value))} />
        </Field>
        <Field label="Participants">
          <input type="number" className={inputCls} value={p.participants} onChange={(e) => set('participants', num(e.target.value))} />
        </Field>

        <Field label="Sale start">
          <input
            type="datetime-local"
            className={inputCls}
            value={isoToLocal(p.startAt)}
            onChange={(e) => set('startAt', localToIso(e.target.value))}
          />
        </Field>
        <Field label="Sale end">
          <input
            type="datetime-local"
            className={inputCls}
            value={isoToLocal(p.endAt)}
            onChange={(e) => set('endAt', localToIso(e.target.value))}
          />
        </Field>

        <Field label="Listing copy">
          <input className={inputCls} value={p.listing} onChange={(e) => set('listing', e.target.value)} />
        </Field>
        <Field label="Contract address">
          <input
            className={inputCls}
            value={p.contract ?? ''}
            onChange={(e) => set('contract', e.target.value || null)}
          />
        </Field>

        <Field label="Logo letter">
          <input className={inputCls} maxLength={2} value={p.logo.letter} onChange={(e) => set('logo', { ...p.logo, letter: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo from">
            <input type="color" className={`${inputCls} h-[38px] p-1`} value={p.logo.from} onChange={(e) => set('logo', { ...p.logo, from: e.target.value })} />
          </Field>
          <Field label="Logo to">
            <input type="color" className={`${inputCls} h-[38px] p-1`} value={p.logo.to} onChange={(e) => set('logo', { ...p.logo, to: e.target.value })} />
          </Field>
        </div>

        <Field label="Website">
          <input className={inputCls} value={p.socials.website ?? ''} onChange={(e) => set('socials', { ...p.socials, website: e.target.value })} />
        </Field>
        <Field label="X / Twitter">
          <input className={inputCls} value={p.socials.x ?? ''} onChange={(e) => set('socials', { ...p.socials, x: e.target.value })} />
        </Field>
        <Field label="Discord">
          <input className={inputCls} value={p.socials.discord ?? ''} onChange={(e) => set('socials', { ...p.socials, discord: e.target.value })} />
        </Field>
        <Field label="Docs">
          <input className={inputCls} value={p.socials.docs ?? ''} onChange={(e) => set('socials', { ...p.socials, docs: e.target.value })} />
        </Field>
        <Field label="Audit report URL" wide>
          <input className={inputCls} value={p.auditUrl ?? ''} onChange={(e) => set('auditUrl', e.target.value || undefined)} />
        </Field>

        <Field label="Settlement (Phase 3)">
          <select
            className={inputCls}
            value={p.settlement ?? 'offchain'}
            onChange={(e) => set('settlement', e.target.value as SettlementMode)}
          >
            <option value="offchain">offchain · simulated (Phase 1)</option>
            <option value="onchain">onchain · real contract</option>
          </select>
        </Field>
        {p.settlement === 'onchain' && (
          <>
            <Field label="Sale chain">
              <select
                className={inputCls}
                value={p.chainId ?? ''}
                onChange={(e) => set('chainId', e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">— pick a chain —</option>
                {Object.entries(ONCHAIN_CHAINS).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.name} ({id}){info.testnet ? ' · testnet' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ApogeeSale contract address" wide>
              <input
                className={inputCls}
                placeholder="0x…"
                value={p.saleContract ?? ''}
                onChange={(e) => set('saleContract', e.target.value || undefined)}
              />
            </Field>
          </>
        )}

        <Field label={`Tokenomics (sum ${tokenomicsSum}%)`} wide>
          <div className="flex flex-col gap-2">
            {p.tokenomics.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={t.label}
                  onChange={(e) => {
                    const next = [...p.tokenomics];
                    next[i] = { ...t, label: e.target.value };
                    set('tokenomics', next);
                  }}
                />
                <input
                  type="number"
                  className={`${inputCls} !w-24`}
                  value={t.pct}
                  onChange={(e) => {
                    const next = [...p.tokenomics];
                    next[i] = { ...t, pct: num(e.target.value) };
                    set('tokenomics', next);
                  }}
                />
                <button
                  className="text-faint hover:text-red"
                  onClick={() => set('tokenomics', p.tokenomics.filter((_, j) => j !== i))}
                  aria-label="Remove slice"
                >
                  <IconX size={14} />
                </button>
              </div>
            ))}
            <button
              className="btn btn-dim self-start !px-3 !py-1.5 !text-[12px]"
              onClick={() => set('tokenomics', [...p.tokenomics, { label: 'New', pct: 0 }])}
            >
              + Slice
            </button>
            {Math.abs(tokenomicsSum - 100) > 0.01 && (
              <p className="text-[11.5px] text-red">Percentages must sum to 100.</p>
            )}
          </div>
        </Field>

        <Field label="TGE unlock %">
          <input type="number" className={inputCls} value={p.vesting.tgePct} onChange={(e) => set('vesting', { ...p.vesting, tgePct: num(e.target.value) })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliff (months)">
            <input type="number" className={inputCls} value={p.vesting.cliffMonths} onChange={(e) => set('vesting', { ...p.vesting, cliffMonths: num(e.target.value) })} />
          </Field>
          <Field label="Linear (months)">
            <input type="number" className={inputCls} value={p.vesting.linearMonths} onChange={(e) => set('vesting', { ...p.vesting, linearMonths: num(e.target.value) })} />
          </Field>
        </div>

        {p.status === 'ended' && (
          <>
            <Field label="ROI × (ended)">
              <input type="number" step="any" className={inputCls} value={p.roi ?? ''} onChange={(e) => set('roi', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="ATH × (ended)">
              <input type="number" step="any" className={inputCls} value={p.ath ?? ''} onChange={(e) => set('ath', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="CEX listings (comma-separated)" wide>
              <input
                className={inputCls}
                value={(p.cex ?? []).join(', ')}
                onChange={(e) =>
                  set('cex', e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined)
                }
              />
            </Field>
          </>
        )}

        <div className="col-span-2 flex flex-wrap items-center gap-5 border-t border-line pt-4 max-[640px]:col-span-1">
          {(
            [
              ['audited', 'Audited'],
              ['kycTeam', 'KYC team'],
              ['featured', 'Featured (pinned hero)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={Boolean(p[key])}
                onChange={(e) => set(key, e.target.checked as never)}
                className="accent-[#C9A366]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button className="btn btn-gold" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <span className="spinner" /> : existingSlug ? 'Save changes' : 'Create project'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {existingSlug && (
          <button
            className="btn btn-dim ml-auto !text-red"
            disabled={del.isPending}
            onClick={() => {
              if (window.confirm(`Delete ${initial.name}? This cannot be undone.`)) del.mutate();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */

function NewsTab({ token }: { token: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', tag: 'news' as 'news' | 'update' | 'alert' });
  const list = useQuery({
    queryKey: ['news'],
    queryFn: () => fetch('/api/news').then((r) => r.json()).then((r) => r.announcements),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createNews(token, form),
    onSuccess: () => {
      toast.success('Announcement published');
      setForm({ title: '', body: '', tag: 'news' });
      qc.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err) => toast.error('Publish failed', errMsg(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteNews(token, id),
    onSuccess: () => {
      toast.success('Announcement deleted');
      qc.invalidateQueries({ queryKey: ['news'] });
    },
    onError: (err) => toast.error('Delete failed', errMsg(err)),
  });

  return (
    <div className="flex flex-col gap-5">
      <section className="panel grid grid-cols-2 gap-4 p-6 max-[640px]:grid-cols-1">
        <Field label="Title">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Tag">
          <select className={inputCls} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value as typeof form.tag })}>
            <option value="news">news</option>
            <option value="update">update</option>
            <option value="alert">alert</option>
          </select>
        </Field>
        <Field label="Body" wide>
          <textarea className={`${inputCls} min-h-[100px]`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <div>
          <button
            className="btn btn-gold"
            disabled={form.title.length < 3 || form.body.length < 10 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <span className="spinner" /> : 'Publish'}
          </button>
        </div>
      </section>

      {(list.data ?? []).map((a: { id: string; title: string; tag: string; ts: string; body: string }) => (
        <section key={a.id} className="panel p-5">
          <div className="flex items-center gap-2.5">
            <span className="pill">{a.tag}</span>
            <span className="text-[13.5px] font-semibold text-ivory">{a.title}</span>
            <span className="num ml-auto text-[10.5px] text-faint">{timeAgo(a.ts)}</span>
            <button
              className="btn btn-dim !px-3 !py-1 !text-[11px] !text-red"
              disabled={remove.isPending}
              onClick={() => window.confirm(`Delete "${a.title}"?`) && remove.mutate(a.id)}
            >
              Delete
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-[12.5px] text-muted">{a.body}</p>
        </section>
      ))}
    </div>
  );
}

/* ── Applications inbox ───────────────────────────────────────────── */

const APP_STATUS_META: Record<ApplicationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'pill-upcoming' },
  accepted: { label: 'Approved', cls: 'pill-live' },
  rejected: { label: 'Rejected', cls: 'pill-red' },
};

const APP_FILTERS = ['pending', 'accepted', 'rejected', 'all'] as const;
type AppFilter = (typeof APP_FILTERS)[number];

function ApplicationsTab({
  token,
  query,
  onCreateFromApp,
}: {
  token: string;
  query: UseQueryResult<ApplicationDTO[]>;
  onCreateFromApp: (a: ApplicationDTO) => void;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<AppFilter>('pending');

  const decide = useMutation({
    mutationFn: (v: { id: string; status: ApplicationStatus }) =>
      adminApi.setApplicationStatus(token, v.id, v.status),
    onSuccess: (_res, v) => {
      toast.success(
        v.status === 'accepted'
          ? 'Application accepted'
          : v.status === 'rejected'
            ? 'Application rejected'
            : 'Application reopened',
      );
      qc.invalidateQueries({ queryKey: ['admin-applications'] });
    },
    onError: (err) => toast.error('Update failed', errMsg(err)),
  });

  if (query.isLoading) return <Skeleton className="h-[300px] !rounded-2xl" />;

  const all = query.data ?? [];
  const counts: Record<AppFilter, number> = {
    pending: all.filter((a) => a.status === 'pending').length,
    accepted: all.filter((a) => a.status === 'accepted').length,
    rejected: all.filter((a) => a.status === 'rejected').length,
    all: all.length,
  };
  const rows = filter === 'all' ? all : all.filter((a) => a.status === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 self-start rounded-xl border border-line bg-panel p-1">
        {APP_FILTERS.map((f) => (
          <button key={f} className="tab capitalize" data-on={filter === f} onClick={() => setFilter(f)}>
            {f}
            <span className="num ml-1.5 text-[10px] text-faint">{counts[f]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="panel p-10 text-center text-[13px] text-muted">
          {all.length === 0
            ? 'No applications yet.'
            : filter === 'pending'
              ? 'Nothing waiting for review — you’re all caught up.'
              : `No ${filter} applications.`}
        </div>
      ) : (
        rows.map((a) => {
          const busy = decide.isPending && decide.variables?.id === a.id;
          return (
            <section key={a.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                {a.logo && (
                  <img
                    src={a.logo}
                    alt=""
                    className="h-7 w-7 flex-none rounded-lg border border-line object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="text-[14px] font-semibold text-ivory">{a.projectName}</span>
                <span className="num text-[11px] text-faint">{a.ticker}</span>
                <ChainPill chain={a.chain} />
                {a.raiseTarget > 0 && <span className="pill pill-gold">{fmtUsdCompact(a.raiseTarget)}</span>}
                <span className={`pill ${APP_STATUS_META[a.status].cls}`}>
                  {APP_STATUS_META[a.status].label}
                </span>
                <span className="num ml-auto text-[10.5px] text-faint">
                  {a.reviewedAt ? `reviewed ${timeAgo(a.reviewedAt)}` : timeAgo(a.ts)}
                </span>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{a.pitch}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[12px]">
                <a
                  href={a.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-gold hover:underline"
                >
                  {a.website}
                </a>
                {a.x && (
                  <a href={a.x} target="_blank" rel="noreferrer noopener" className="text-muted hover:text-ivory">
                    X
                  </a>
                )}
                {a.telegram && (
                  <a href={a.telegram} target="_blank" rel="noreferrer noopener" className="text-muted hover:text-ivory">
                    Telegram
                  </a>
                )}
                <a href={`mailto:${a.contactEmail}`} className="text-muted hover:text-ivory">
                  {a.contactEmail}
                </a>
                {a.devHandle && (
                  <a
                    href={`https://t.me/${a.devHandle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted hover:text-ivory"
                  >
                    dev TG {a.devHandle.startsWith('@') ? a.devHandle : `@${a.devHandle}`}
                  </a>
                )}
                {a.devEmail && (
                  <a href={`mailto:${a.devEmail}`} className="text-muted hover:text-ivory">
                    {a.devEmail}
                  </a>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {a.status !== 'accepted' && (
                    <button
                      className="btn btn-dim !px-3 !py-1.5 !text-[12px] !text-mint"
                      disabled={busy}
                      onClick={() => decide.mutate({ id: a.id, status: 'accepted' })}
                    >
                      <IconCheck size={13} /> Accept
                    </button>
                  )}
                  {a.status !== 'rejected' && (
                    <button
                      className="btn btn-dim !px-3 !py-1.5 !text-[12px] !text-red"
                      disabled={busy}
                      onClick={() => decide.mutate({ id: a.id, status: 'rejected' })}
                    >
                      <IconX size={13} /> Reject
                    </button>
                  )}
                  {a.status !== 'pending' && (
                    <button
                      className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                      disabled={busy}
                      onClick={() => decide.mutate({ id: a.id, status: 'pending' })}
                    >
                      Reopen
                    </button>
                  )}
                  {a.status === 'accepted' && (
                    <button
                      className="btn btn-gold !px-3 !py-1.5 !text-[12px]"
                      onClick={() => onCreateFromApp(a)}
                    >
                      <IconRocket size={13} /> Create launch
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function AdminPanel() {
  const token = useAdmin((s) => s.adminToken)!;
  const setToken = useAdmin((s) => s.setToken);
  const [tab, setTab] = useState<'projects' | 'applications' | 'news'>('projects');
  const [editing, setEditing] = useState<{ input: AdminProjectInput; slug: string | null } | null>(null);

  const projects = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => adminApi.projects(token).then((r) => r.projects),
    retry: false,
  });
  // Always loaded (cheap) so the pending badge shows from any tab.
  const applications = useQuery({
    queryKey: ['admin-applications'],
    queryFn: () => adminApi.applications(token).then((r) => r.applications),
    retry: false,
  });
  const pendingCount = (applications.data ?? []).filter((a) => a.status === 'pending').length;

  // Expired/invalid admin token → back to login.
  if (projects.error instanceof ApiError && projects.error.status === 401) {
    setToken(null);
    return null;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1">
          {(['projects', 'applications', 'news'] as const).map((t) => (
            <button key={t} className="tab capitalize" data-on={tab === t} onClick={() => setTab(t)}>
              {t}
              {t === 'applications' && pendingCount > 0 && (
                <span className="num ml-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === 'projects' && !editing && (
          <button className="btn btn-gold ml-auto" onClick={() => setEditing({ input: BLANK, slug: null })}>
            + New project
          </button>
        )}
        <button
          className={`btn btn-dim ${tab === 'projects' && !editing ? '' : 'ml-auto'}`}
          onClick={() => setToken(null)}
        >
          Log out
        </button>
      </div>

      {editing ? (
        <ProjectEditor
          initial={editing.input}
          existingSlug={editing.slug}
          onClose={() => setEditing(null)}
        />
      ) : tab === 'news' ? (
        <NewsTab token={token} />
      ) : tab === 'projects' ? (
        projects.isLoading ? (
          <Skeleton className="h-[300px] !rounded-2xl" />
        ) : (
          <section className="panel overflow-x-auto">
            <table className="tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Chain</th>
                  <th>Status</th>
                  <th>Raised</th>
                  <th>Featured</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {(projects.data ?? []).map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <span className="flex items-center gap-3">
                        <LogoTile logo={p.logo} size={30} radius={9} />
                        <span>
                          <span className="block text-[13px] font-semibold text-ivory">{p.name}</span>
                          <span className="num text-[10.5px] text-faint">{p.ticker} · /{p.slug}</span>
                        </span>
                      </span>
                    </td>
                    <td><ChainPill chain={p.chain} /></td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="num text-muted">
                      {fmtUsdCompact(p.raised)} / {fmtUsdCompact(p.hardCap)}
                    </td>
                    <td>{p.featured ? <IconCheck size={14} className="text-gold" /> : <span className="text-faint">—</span>}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        onClick={() => setEditing({ input: toInput(p), slug: p.slug })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      ) : (
        <ApplicationsTab
          token={token}
          query={applications}
          onCreateFromApp={(a) => {
            setEditing({ input: appToProjectInput(a), slug: null });
            setTab('projects');
          }}
        />
      )}
    </div>
  );
}

export function Admin() {
  const token = useAdmin((s) => s.adminToken);
  return token ? <AdminPanel /> : <AdminLogin />;
}
