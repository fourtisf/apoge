import { useState } from 'react';
import { CHAIN_META, type Chain } from '@apogee/shared';
import { IconCheck } from '../components/icons';
import { api, ApiError } from '../lib/api';
import { toast } from '../state/store';

const inputCls =
  'w-full rounded-xl border border-line-strong bg-panel2 px-3 py-2.5 text-[13px] text-ivory outline-none transition-colors focus:border-gold/50';

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

/** Read an image file, cover-crop to a centered square, resize, and encode as
 *  a compact data URL — kept small so it fits in the request and the DB. */
async function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('not an image'));
    im.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  const side = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  let quality = 0.85;
  let out = canvas.toDataURL('image/webp', quality);
  while (out.length > 90_000 && quality > 0.4) {
    quality -= 0.15;
    out = canvas.toDataURL('image/webp', quality);
  }
  return out;
}

export function Apply() {
  const [form, setForm] = useState({
    projectName: '',
    ticker: '',
    chain: 'SOL' as Chain,
    website: '',
    contactEmail: '',
    raiseTarget: '',
    x: '',
    telegram: '',
    logo: '',
    devHandle: '',
    devEmail: '',
    pitch: '',
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a remove
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file', 'Please choose an image (PNG, JPG or WebP).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Image too large', 'Please choose a file under 10 MB.');
      return;
    }
    try {
      set('logo', await fileToSquareDataUrl(file));
    } catch {
      toast.error('Could not read image', 'Try a different file.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.apply({
        projectName: form.projectName,
        ticker: form.ticker,
        chain: form.chain,
        website: form.website,
        contactEmail: form.contactEmail,
        pitch: form.pitch,
        raiseTarget: Number(form.raiseTarget) || 0,
        x: form.x || undefined,
        telegram: form.telegram || undefined,
        logo: form.logo || undefined,
        devHandle: form.devHandle || undefined,
        devEmail: form.devEmail || undefined,
      });
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

        <div className="col-span-2 flex flex-col gap-1.5 max-[640px]:col-span-1">
          <span className="label">Project logo</span>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border border-line-strong bg-panel2">
              {form.logo ? (
                <img src={form.logo} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <span className="label !text-[9px] text-faint">LOGO</span>
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onLogoPick}
              />
              <label htmlFor="logo-upload" className="btn btn-dim cursor-pointer !px-3.5 !py-2 !text-[12px]">
                {form.logo ? 'Change logo' : 'Upload logo'}
              </label>
              {form.logo && (
                <button type="button" className="text-[11px] text-red hover:underline" onClick={() => set('logo', '')}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <span className="text-[11px] leading-relaxed text-faint">
            Square image like a profile picture — we resize it to 256×256. PNG, JPG or WebP, up to 10 MB.
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="label">Raise target (USD)</span>
          <input
            className={inputCls}
            type="number"
            required
            min={1}
            step="any"
            placeholder="e.g. 250000"
            value={form.raiseTarget}
            onChange={(e) => set('raiseTarget', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">X / Twitter</span>
          <input className={inputCls} type="url" placeholder="https://x.com/…" value={form.x} onChange={(e) => set('x', e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label">Telegram</span>
          <input className={inputCls} type="url" placeholder="https://t.me/…" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Dev email (optional)</span>
          <input className={inputCls} type="email" placeholder="dev@project.xyz" value={form.devEmail} onChange={(e) => set('devEmail', e.target.value)} />
        </label>

        <label className="col-span-2 flex flex-col gap-1.5 max-[640px]:col-span-1">
          <span className="label">Dev Telegram (optional)</span>
          <input className={inputCls} placeholder="@yourdev" value={form.devHandle} onChange={(e) => set('devHandle', e.target.value)} />
          <span className="text-[11px] leading-relaxed text-faint">
            The developer’s Telegram username so we can reach the dev directly — e.g. @yourdev.
          </span>
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
