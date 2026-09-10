import type { TranscriptSegment as Segment } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TranscriptSegment({
  segment,
  active = false,
  onSelect,
}: {
  segment: Segment;
  active?: boolean;
  onSelect?: ((seconds: number) => void) | undefined;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(segment.startSeconds)}
      className={cn(
        "flex w-full gap-3 rounded-lg px-2 py-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <span className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums text-primary">
        {formatTimestamp(segment.startSeconds)}
      </span>
      <p className="min-w-0 text-[15px] leading-relaxed text-foreground/90">
        {segment.text}
      </p>
    </button>
  );
}
