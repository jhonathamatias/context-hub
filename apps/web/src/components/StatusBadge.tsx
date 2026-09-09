import type { SourceStatus } from '../api/types';

const STYLES: Record<SourceStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  PROCESSING: 'bg-sky-100 text-sky-900',
  READY: 'bg-emerald-100 text-emerald-900',
  FAILED: 'bg-rose-100 text-rose-900',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status as SourceStatus] ?? 'bg-stone-200 text-stone-800';
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}
