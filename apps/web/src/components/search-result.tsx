import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { SearchHit } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";

export function SearchResult({ hit }: { hit: SearchHit }) {
  return (
    <Link
      to="/aulas/$lessonId"
      params={{ lessonId: hit.lessonId }}
      search={{ t: Math.floor(hit.startSeconds) }}
      className="group block rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{hit.lessonTitle}</span>
        <span className="font-mono text-xs tabular-nums text-primary">
          {formatTimestamp(hit.startSeconds)}
          {hit.endSeconds > hit.startSeconds ? ` — ${formatTimestamp(hit.endSeconds)}` : ""}
        </span>
      </div>
      {hit.excerpt ? (
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">
          “{hit.excerpt}”
        </p>
      ) : null}
      <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
        Ver trecho <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
