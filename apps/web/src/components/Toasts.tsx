import { useToasts } from '../state/store';
import { IconCheck, IconX } from './icons';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2.5 max-sm:bottom-20 max-sm:right-4 max-sm:left-4">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} role="status">
          <div
            className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full"
            style={{
              background:
                t.kind === 'success'
                  ? 'rgba(61,214,140,.15)'
                  : t.kind === 'error'
                    ? 'rgba(229,72,77,.15)'
                    : 'rgba(201,163,102,.15)',
              color: t.kind === 'success' ? '#3DD68C' : t.kind === 'error' ? '#E5484D' : '#C9A366',
            }}
          >
            {t.kind === 'error' ? <IconX size={11} /> : <IconCheck size={11} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ivory">{t.title}</div>
            {t.body && <div className="mt-0.5 text-xs text-muted">{t.body}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-faint transition-colors hover:text-ivory"
            aria-label="Dismiss notification"
          >
            <IconX size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
