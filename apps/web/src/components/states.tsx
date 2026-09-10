import type { ReactNode } from "react";
import {
  Check,
  Download,
  FileAudio2,
  LoaderCircle,
  Search,
  Sparkles,
  Subtitles,
  type LucideIcon,
} from "lucide-react";
import type { LessonPipeline } from "@/lib/api";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      <h3 className="display-title text-xl">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-1/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

type Progress = NonNullable<LessonPipeline["progress"]>;

const PIPELINE_STEPS: ReadonlyArray<{
  key: string;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "INGEST", label: "Baixando vídeo", icon: Download },
  { key: "EXTRACT_AUDIO", label: "Extraindo áudio", icon: FileAudio2 },
  { key: "TRANSCRIBE", label: "Gerando transcrição", icon: Subtitles },
  { key: "EXTRACT_KNOWLEDGE", label: "Extraindo conhecimento", icon: Sparkles },
  { key: "EMBED", label: "Indexando busca", icon: Search },
];

const STAGE_ORDER = [
  "INGEST",
  "EXTRACT_AUDIO",
  "TRANSCRIBE",
  "EXTRACT_KNOWLEDGE",
  "EMBED",
  "INDEX",
  "DONE",
] as const;

function stepState(
  stepKey: string,
  stage: string,
  overallPercent: number,
): "done" | "active" | "todo" {
  if (stage === "DONE" || overallPercent >= 100) return "done";
  const currentIdx = STAGE_ORDER.indexOf(
    stage as (typeof STAGE_ORDER)[number],
  );
  const stepIdx = STAGE_ORDER.indexOf(stepKey as (typeof STAGE_ORDER)[number]);
  if (currentIdx < 0 || stepIdx < 0) {
    return stepKey === stage ? "active" : "todo";
  }
  if (currentIdx > stepIdx) return "done";
  if (currentIdx === stepIdx) return "active";
  return "todo";
}

function secondaryDetail(
  stage: string,
  progress: Progress | null | undefined,
  detail: string | null,
): string | null {
  if (stage === "TRANSCRIBE" && progress?.transcriptionPercent != null) {
    return `Transcrição ${Math.round(progress.transcriptionPercent)}%`;
  }
  if (stage === "INGEST" && progress?.ingestPercent != null) {
    const base = `Download ${Math.round(progress.ingestPercent)}%`;
    return detail ? `${base} · ${detail}` : base;
  }
  return detail;
}

function PipelineSteps({
  stage,
  percent,
  compact = false,
}: {
  stage: string;
  percent: number;
  compact?: boolean;
}) {
  return (
    <ol className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
      {PIPELINE_STEPS.map((step) => {
        const state = stepState(step.key, stage, percent);
        const Icon = step.icon;
        return (
          <li
            key={step.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm border",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
              state === "done" &&
                "border-border/80 bg-muted/30 text-muted-foreground",
              state === "active" &&
                "border-primary/30 bg-primary/10 text-foreground",
              state === "todo" &&
                "border-transparent text-muted-foreground/50",
            )}
          >
            {state === "done" ? (
              <Check
                className={cn(
                  "shrink-0 text-primary",
                  compact ? "size-2.5" : "size-3",
                )}
                strokeWidth={2.5}
              />
            ) : state === "active" ? (
              <LoaderCircle
                className={cn(
                  "shrink-0 animate-spin text-primary",
                  compact ? "size-2.5" : "size-3",
                )}
              />
            ) : (
              <Icon
                className={cn(
                  "shrink-0 opacity-70",
                  compact ? "size-2.5" : "size-3",
                )}
              />
            )}
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProcessingIndicator({
  compact = false,
  progress,
  className,
}: {
  compact?: boolean;
  progress?: Progress | null;
  className?: string;
}) {
  const percent = Math.round(progress?.percent ?? 0);
  const stage = progress?.stage ?? "TRANSCRIBE";
  const label = progress?.label ?? "Preparando aula";
  const detail = secondaryDetail(
    stage,
    progress,
    progress?.detail ?? null,
  );

  if (compact) {
    return (
      <div className={cn("w-full max-w-md", className)}>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-xs text-muted-foreground">{label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {percent}%
          </span>
        </div>
        <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="processing-bar-fill h-full rounded-full"
            style={{ width: `${Math.max(percent, 2)}%` }}
          />
        </div>
        {detail ? (
          <p className="mt-1 truncate text-[10px] text-muted-foreground/80">
            {detail}
          </p>
        ) : null}
        <div className="mt-2">
          <PipelineSteps stage={stage} percent={percent} compact />
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card/60 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{label}</p>
          {detail ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {detail}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="processing-bar-fill h-full rounded-full"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>

      <div className="mt-3">
        <PipelineSteps stage={stage} percent={percent} />
      </div>
    </section>
  );
}

export function SoftError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
