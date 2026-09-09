import type { LessonStatus as Status } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  READY: "bg-success/10 text-success border-success/20",
  PROCESSING: "bg-warning/15 text-warning-foreground border-warning/30",
  PENDING: "bg-muted text-muted-foreground border-border",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

export function LessonStatus({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium',
        styles[status],
        className,
      )}
    >
      {status === 'PROCESSING' ? (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {statusLabel[status]}
    </span>
  );
}
