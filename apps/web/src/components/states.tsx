import type { ReactNode } from "react";
import {
  Check,
  FileAudio2,
  LoaderCircle,
  Search,
  Sparkles,
  Subtitles,
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

const PIPELINE_STEPS = [
  {
    key: "EXTRACT_AUDIO",
    label: "Áudio",
    hint: "Separando o som do vídeo",
    icon: FileAudio2,
  },
  {
    key: "TRANSCRIBE",
    label: "Transcrição",
    hint: "Convertendo fala em texto",
    icon: Subtitles,
  },
  {
    key: "EXTRACT_KNOWLEDGE",
    label: "Conhecimento",
    hint: "Resumo e tópicos da aula",
    icon: Sparkles,
  },
  {
    key: "EMBED",
    label: "Busca",
    hint: "Indexando para perguntas",
    icon: Search,
  },
] as const;

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
  if (
    currentIdx === stepIdx ||
    (stage === "INGEST" && stepKey === "EXTRACT_AUDIO")
  ) {
    return "active";
  }
  return "todo";
}

/** Percent shown on each pipeline step card. */
function stepPercent(
  stepKey: string,
  state: "done" | "active" | "todo",
  progress: Progress | null | undefined,
): number {
  if (state === "done") return 100;
  if (state === "todo") return 0;
  if (stepKey === "TRANSCRIBE") {
    return Math.round(progress?.transcriptionPercent ?? progress?.percent ?? 0);
  }
  // Active non-transcribe stages: map overall band into 0–100 for the step.
  const overall = progress?.percent ?? 0;
  if (stepKey === "EXTRACT_AUDIO") return Math.min(100, Math.max(8, overall * 6));
  if (stepKey === "EXTRACT_KNOWLEDGE") {
    return overall >= 90 ? Math.min(100, (overall - 85) * 8) : 5;
  }
  if (stepKey === "EMBED") {
    return overall >= 95 ? Math.min(100, (overall - 94) * 16) : 5;
  }
  return Math.round(overall);
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
  const detail =
    progress?.detail ??
    "Isso pode levar alguns minutos. Você pode sair e voltar depois.";
  const transcriptionPercent =
    progress?.transcriptionPercent != null
      ? Math.round(progress.transcriptionPercent)
      : null;

  if (compact) {
    return (
      <div className={cn("w-full max-w-sm", className)}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" />
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
            {percent}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="processing-bar-fill h-full rounded-full"
            style={{ width: `${Math.max(percent, 3)}%` }}
          />
        </div>
        {transcriptionPercent != null && stage === "TRANSCRIBE" ? (
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            Transcrição {transcriptionPercent}%
            {detail ? ` · ${detail}` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="border-b border-border bg-accent/30 px-5 py-5 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              <LoaderCircle className="size-3.5 animate-spin" />
              Em processamento
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-primary sm:text-5xl">
              {percent}
              <span className="text-xl text-muted-foreground">%</span>
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              progresso total
            </p>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="processing-bar-fill h-full rounded-full"
            style={{ width: `${Math.max(percent, 3)}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
          <span>
            {transcriptionPercent != null && stage === "TRANSCRIBE"
              ? `Transcrição: ${transcriptionPercent}%`
              : "Acompanhe cada etapa abaixo"}
          </span>
          <span className="font-semibold text-foreground">{percent}% / 100%</span>
        </div>
      </div>

      <ol className="grid gap-0 sm:grid-cols-4">
        {PIPELINE_STEPS.map((step, index) => {
          const state = stepState(step.key, stage, percent);
          const pct = stepPercent(step.key, state, progress);
          const Icon = step.icon;
          return (
            <li
              key={step.key}
              className={cn(
                "relative px-4 py-4 sm:px-5",
                index < PIPELINE_STEPS.length - 1
                  ? "border-b border-border sm:border-r sm:border-b-0"
                  : "",
                state === "active" ? "bg-primary/5" : "",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                      state === "done" &&
                        "border-primary/40 bg-primary text-primary-foreground",
                      state === "active" &&
                        "border-primary/50 bg-primary/15 text-primary",
                      state === "todo" &&
                        "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-4" strokeWidth={2.5} />
                    ) : state === "active" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Icon className="size-3.5 opacity-60" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        state === "todo"
                          ? "text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {state === "active" ? step.hint : state === "done" ? "Concluído" : "Na fila"}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-base font-semibold tabular-nums",
                    state === "active" && "text-primary",
                    state === "done" && "text-foreground",
                    state === "todo" && "text-muted-foreground/70",
                  )}
                >
                  {pct}%
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    state === "active"
                      ? "processing-bar-fill"
                      : state === "done"
                        ? "bg-primary"
                        : "bg-transparent",
                  )}
                  style={{ width: `${Math.max(pct, state === "todo" ? 0 : 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
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
