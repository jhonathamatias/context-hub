import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TimestampLink({
  seconds,
  endSeconds,
  onSelect,
  className,
}: {
  seconds: number;
  endSeconds?: number | undefined;
  onSelect?: ((seconds: number) => void) | undefined;
  className?: string | undefined;
}) {
  const label =
    endSeconds && endSeconds > seconds
      ? `${formatTimestamp(seconds)} — ${formatTimestamp(endSeconds)}`
      : formatTimestamp(seconds);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(seconds)}
      className={cn(
        "rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary transition-colors hover:bg-accent",
        className,
      )}
    >
      {label}
    </button>
  );
}
