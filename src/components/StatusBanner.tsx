interface StatusBannerProps {
  kind: 'success' | 'error' | 'info' | 'warning';
  children: React.ReactNode;
}

const STYLES: Record<StatusBannerProps['kind'], string> = {
  success: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50',
  error: 'bg-rose-900/40 text-rose-200 border-rose-700/50',
  info: 'bg-sky-900/40 text-sky-200 border-sky-700/50',
  warning: 'bg-amber-900/40 text-amber-200 border-amber-700/50',
};

export function StatusBanner({ kind, children }: StatusBannerProps) {
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${STYLES[kind]}`}>
      {children}
    </div>
  );
}
