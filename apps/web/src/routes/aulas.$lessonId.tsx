import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircleQuestion } from "lucide-react";
import { api } from "@/lib/api";
import { groupTranscriptSegments } from "@/lib/group-transcript-segments";
import { Button } from "@/components/ui/button";
import { LessonStatus } from "@/components/lesson-status";
import { LessonPlayer, type LessonPlayerHandle } from "@/components/lesson-player";
import { TranscriptSegment } from "@/components/transcript-segment";
import { EmptyState, LoadingSkeleton, ProcessingIndicator, SoftError } from "@/components/states";
import { FeedbackAlert } from "@/components/ui/alert";
import { PageFrame, PageFrameWidth } from "@/components/page-frame";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = { t?: number };

export const Route = createFileRoute("/aulas/$lessonId")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const t = Number(search["t"]);
    return Number.isFinite(t) && t > 0 ? { t } : {};
  },
  head: () => ({
    meta: [
      { title: "Aula — Context Hub" },
      { name: "description", content: "Assista, leia a transcrição e revise o que foi estudado." },
      { property: "og:title", content: "Aula — Context Hub" },
      {
        property: "og:description",
        content: "Assista, leia a transcrição e revise o que foi estudado.",
      },
    ],
  }),
  component: LessonPage,
});

type Tab = "resumo" | "topicos";

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { t } = Route.useSearch();
  const playerRef = useRef<LessonPlayerHandle | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [currentTime, setCurrentTime] = useState(t ?? 0);
  const [seekApplied, setSeekApplied] = useState(false);
  const queryClient = useQueryClient();

  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => api.getLesson(lessonId),
    retry: false,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      if (data.status === "PROCESSING" || data.status === "PENDING") return 2000;
      if (data.pipeline?.knowledgeStatus === "PROCESSING") return 2000;
      return false;
    },
  });

  const pipeline = lesson.data?.pipeline;
  const hasTranscript = pipeline?.transcriptionStatus === "COMPLETED";
  const knowledgeFailed = pipeline?.knowledgeStatus === "FAILED";
  const knowledgeProcessing = pipeline?.knowledgeStatus === "PROCESSING";
  const hasKnowledge =
    pipeline?.knowledgeStatus === "COMPLETED" || knowledgeFailed;
  const needsSearchIndex =
    hasTranscript && (pipeline?.embeddingCount ?? 0) === 0;
  const canRetryPipeline =
    hasTranscript &&
    (knowledgeFailed || needsSearchIndex || lesson.data?.status === "FAILED");

  const transcript = useQuery({
    queryKey: ["transcript", lessonId],
    queryFn: () => api.getTranscript(lessonId),
    enabled: Boolean(lessonId) && hasTranscript,
    retry: false,
  });

  const knowledge = useQuery({
    queryKey: ["knowledge", lessonId],
    queryFn: () => api.getKnowledge(lessonId),
    enabled:
      Boolean(lessonId) &&
      pipeline?.knowledgeStatus === "COMPLETED",
    retry: false,
  });

  // When knowledge flips to COMPLETED after polling, ensure content is fetched.
  useEffect(() => {
    if (pipeline?.knowledgeStatus === "COMPLETED") {
      void queryClient.invalidateQueries({ queryKey: ["knowledge", lessonId] });
    }
  }, [pipeline?.knowledgeStatus, lessonId, queryClient]);

  const retryPipeline = useMutation({
    mutationFn: async () => {
      const current = lesson.data;
      if (!current) throw new Error("Aula não carregada");
      await api.retryPipeline(current);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge", lessonId] });
      await queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });

  const seek = (seconds: number) => {
    setCurrentTime(seconds);
    playerRef.current?.seekTo(seconds);
  };

  useEffect(() => {
    if (seekApplied || t == null || !lesson.data?.videoUrl) return;
    const timer = window.setTimeout(() => {
      playerRef.current?.seekTo(t);
      setCurrentTime(t);
      setSeekApplied(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [lesson.data?.videoUrl, seekApplied, t]);

  if (lesson.isLoading) {
    return (
      <PageFrame width={PageFrameWidth.Full}>
        <LoadingSkeleton rows={3} />
      </PageFrame>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <PageFrame width={PageFrameWidth.Lg}>
        <SoftError message="Não conseguimos abrir esta aula agora. Volte à biblioteca e tente novamente." />
      </PageFrame>
    );
  }

  const data = lesson.data;
  const isProcessing =
    data.status === "PROCESSING" ||
    data.status === "PENDING" ||
    knowledgeProcessing;
  const showProcessIndicator =
    isProcessing ||
    (pipeline?.progress?.stage != null &&
      pipeline.progress.stage !== "DONE" &&
      pipeline.progress.percent < 100);
  const meta = [formatDate(data.createdAt ?? data.updatedAt), formatDuration(data.durationSeconds)]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageFrame width={PageFrameWidth.Full}>
      <Link
        to="/biblioteca"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Biblioteca
      </Link>

      <header className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="display-title text-xl leading-tight sm:text-3xl">{data.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <LessonStatus
              status={data.status}
              percent={pipeline?.progress?.percent}
            />
            {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
          </div>
        </div>
        {isProcessing ? (
          <Button className="shrink-0" disabled>
            <MessageCircleQuestion className="size-4" />
            <span className="hidden sm:inline">Disponível em breve</span>
            <span className="sm:hidden">Aguarde</span>
          </Button>
        ) : (
          <Button asChild className="shrink-0">
            <Link to="/perguntar" search={{ aula: lessonId }}>
              <MessageCircleQuestion className="size-4" />
              <span className="hidden sm:inline">Perguntar sobre esta aula</span>
              <span className="sm:hidden">Perguntar</span>
            </Link>
          </Button>
        )}
      </header>

      {showProcessIndicator ? (
        <div className="mt-5">
          <ProcessingIndicator progress={pipeline?.progress} />
        </div>
      ) : null}

      {data.status === "FAILED" || canRetryPipeline ? (
        <div className="mt-4 space-y-3">
          <FeedbackAlert
            tone={knowledgeFailed || needsSearchIndex ? "warning" : "destructive"}
            title={
              knowledgeFailed
                ? "Resumo indisponível"
                : needsSearchIndex
                  ? "Índice de busca pendente"
                  : "Falha no processamento"
            }
          >
            <p>
              {knowledgeFailed
                ? "Não foi possível gerar o resumo agora. A transcrição e a busca continuam disponíveis quando o índice existir."
                : needsSearchIndex
                  ? "A transcrição está pronta, mas o índice de busca ainda não foi gerado."
                  : "Esta aula não pôde ser preparada por completo."}
            </p>
            {pipeline?.knowledgeError ? (
              <p className="mt-2 text-xs opacity-80 line-clamp-3">
                Detalhe: {pipeline.knowledgeError}
              </p>
            ) : null}
            {canRetryPipeline ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={retryPipeline.isPending || isProcessing}
                  onClick={() => retryPipeline.mutate()}
                >
                  {retryPipeline.isPending ? "Reenfileirando…" : "Tentar novamente"}
                </Button>
              </div>
            ) : null}
            {retryPipeline.isError ? (
              <p className="mt-2 text-sm opacity-90">
                {retryPipeline.error instanceof Error
                  ? retryPipeline.error.message
                  : "Não foi possível reenfileirar agora."}
              </p>
            ) : null}
          </FeedbackAlert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <LessonPlayer
            ref={playerRef}
            videoUrl={data.videoUrl}
            onTimeUpdate={(seconds) => setCurrentTime(seconds)}
          />

          <div className="mt-4">
            <div className="flex gap-1 border-b border-border">
              {(
                [
                  ["resumo", "Resumo"],
                  ["topicos", "Tópicos"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                    tab === key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {knowledgeProcessing ? (
                <p className="text-sm text-muted-foreground">
                  Gerando o resumo desta aula…
                </p>
              ) : !hasKnowledge && !knowledgeFailed ? (
                <p className="text-sm text-muted-foreground">
                  O resumo desta aula ainda está sendo preparado.
                </p>
              ) : knowledge.isLoading || knowledge.isFetching ? (
                <LoadingSkeleton rows={2} />
              ) : knowledgeFailed ? (
                <p className="text-sm text-muted-foreground">
                  Resumo indisponível. Use “Tentar novamente” acima para reprocessar
                  a partir dos resultados parciais.
                </p>
              ) : tab === "resumo" ? (
                <div className="space-y-8">
                  {knowledge.data?.summary ? (
                    <p className="text-[17px] leading-relaxed">{knowledge.data.summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      O resumo desta aula ainda está sendo preparado.
                    </p>
                  )}

                  {knowledge.data && knowledge.data.keyIdeas.length > 0 ? (
                    <div>
                      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Principais ideias
                      </h2>
                      <ul className="mt-3 space-y-2">
                        {knowledge.data.keyIdeas.map((idea, i) => (
                          <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                            {idea}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {knowledge.data && knowledge.data.exercises.length > 0 ? (
                    <div>
                      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Exercícios
                      </h2>
                      <ul className="mt-3 space-y-2">
                        {knowledge.data.exercises.map((exercise, i) => (
                          <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                            {exercise}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (knowledge.data?.topics.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {knowledge.data?.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full border border-border bg-card px-3 py-1 text-sm"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Os tópicos desta aula ainda estão sendo preparados.
                </p>
              )}
            </div>
          </div>

          {/* Mobile transcript (desktop uses the side panel) */}
          <div className="mt-8 lg:hidden">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Transcrição
            </h2>
            <div className="mt-2">
              <TranscriptList
                onSelect={seek}
                currentTime={currentTime}
                className="max-h-[50vh] overflow-y-auto pr-1"
              />
            </div>
          </div>
        </div>

        <aside className="hidden min-w-0 lg:block">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Transcrição
          </h2>
          <div className="mt-2">
            <TranscriptList
              onSelect={seek}
              currentTime={currentTime}
              className="max-h-[70vh] overflow-y-auto pr-1"
            />
          </div>
        </aside>
      </div>
    </PageFrame>
  );

  function TranscriptList({
    onSelect,
    currentTime: time,
    className,
  }: {
    onSelect: (seconds: number) => void;
    currentTime: number;
    className?: string | undefined;
  }) {
    if (!hasTranscript) {
      return (
        <p className="text-sm text-muted-foreground">
          A transcrição desta aula ainda não está disponível.
        </p>
      );
    }
    if (transcript.isLoading) return <LoadingSkeleton rows={3} />;
    if (transcript.isError)
      return (
        <p className="text-sm text-muted-foreground">
          A transcrição desta aula ainda não está disponível.
        </p>
      );
    const segments = transcript.data?.segments ?? [];
    if (segments.length === 0)
      return (
        <EmptyState
          title="Sem transcrição"
          description="A transcrição desta aula ainda não está disponível."
        />
      );

    const blocks = groupTranscriptSegments(segments);

    return (
      <div className={cn("space-y-0.5", className)}>
        {blocks.map((block, i) => (
          <TranscriptSegment
            key={`${block.startSeconds}-${i}`}
            segment={{
              startSeconds: block.startSeconds,
              endSeconds: block.endSeconds,
              text: block.text,
            }}
            active={time >= block.startSeconds && time < (block.endSeconds || Infinity)}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }
}
