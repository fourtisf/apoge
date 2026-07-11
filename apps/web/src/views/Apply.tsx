import { useState } from 'react';
import { CHAIN_META, type Chain } from '@apogee/shared';
import { IconCheck } from '../components/icons';
import { api, ApiError } from '../lib/api';
import { toast } from '../state/store';

const inputCls =
  'w-full rounded-xl border border-line-strong bg-panel2 px-3 py-2.5 text-[13px] text-ivory outline-none transition-colors focus:border-gold/50';

export function Apply() {
  const [form, setForm] = useState({
    projectName: '',
    ticker: '',
    chain: 'SOL' as Chain,
    website: '',
    contactEmail: '',
    pitch: '',
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.apply(form);
      setSent(true);
    } catch (err) {
      toast.error(
        'Submission failed',
        err instanceof ApiError ? err.message : 'Please check the fields and try again',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="panel success-pop mx-auto mt-16 max-w-md p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-mint">
          <IconCheck size={20} />
        </div>
        <h1 className="mt-4 text-[17px] font-semibold text-ivory">Application received</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Thanks — the team reviews every submission and will reach out to{' '}
          <span className="text-ivory">{form.contactEmail}</span> if it’s a fit.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-ivory">Apply for Launch</h1>
      <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
        Launching on Solana, Ethereum, Base or BNB? Tell us about the project — we review every
        application and respond within a week.
      </p>

      <form onSubmit={submit} className="panel mt-5 grid grid-cols-2 gap-4 p-7 max-[640px]:grid-cols-1 max-[640px]:p-5">
        <label className="flex flex-col gap-1.5">
          <span className="label">Project name</span>
          <input className={inputCls} required minLength={2} value={form.projectName} onChange={(e) => set('projectName', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Ticker</span>
            <input className={inputCls} required value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Chain</span>
            <select className={inputCls} value={form.chain} onChange={(e) => set('chain', e.target.value as Chain)}>
              {(Object.keys(CHAIN_META) as Chain[]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="label">Website</span>
          <input className={inputCls} type="url" required placeholder="https://…" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Contact email</span>
          <input className={inputCls} type="email" required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5 max-[640px]:col-span-1">
          <span className="label">Pitch — product, traction, raise target (min 30 chars)</span>
          <textarea className={`${inputCls} min-h-[130px]`} required minLength={30} maxLength={2000} value={form.pitch} onChange={(e) => set('pitch', e.target.value)} />
        </label>
        <div className="col-span-2 max-[640px]:col-span-1">
          <button className="btn btn-gold !px-6 !py-3" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Submit application'}
          </button>
        </div>
      </form>
    </div>
  );
}
