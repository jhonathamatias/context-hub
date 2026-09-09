import type { TranscriptSegment as Segment } from "@/lib/api";
import { TimestampLink } from "./timestamp-link";
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
    <div
      className={cn(
        "flex gap-3 rounded-lg px-2 py-2 transition-colors",
        active ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <TimestampLink
        seconds={segment.startSeconds}
        onSelect={onSelect}
        className="mt-0.5 shrink-0"
      />
      <p className="min-w-0 text-[15px] leading-relaxed text-foreground/90">{segment.text}</p>
    </div>
  );
}
