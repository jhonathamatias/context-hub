import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, MessageCircleQuestion } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonStatus } from "@/components/lesson-status";
import { LessonPlayer, type LessonPlayerHandle } from "@/components/lesson-player";
import { TranscriptSegment } from "@/components/transcript-segment";
import { EmptyState, LoadingSkeleton, ProcessingIndicator, SoftError } from "@/components/states";
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

type Tab = "resumo" | "topicos" | "transcricao";

function LessonPage() {
  const { lessonId } = Route.useParams();
  const { t } = Route.useSearch();
  const playerRef = useRef<LessonPlayerHandle | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [currentTime, setCurrentTime] = useState(t ?? 0);

  const lesson = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => api.getLesson(lessonId),
    retry: false,
    refetchInterval: (q) =>
      q.state.data && (q.state.data.status === "PROCESSING" || q.state.data.status === "PENDING")
        ? 4000
        : false,
  });

  const pipeline = lesson.data?.pipeline;
  const hasTranscript = pipeline?.transcriptionStatus === "COMPLETED";
  const hasKnowledge =
    pipeline?.knowledgeStatus === "COMPLETED" ||
    pipeline?.knowledgeStatus === "FAILED";
  const knowledgeFailed = pipeline?.knowledgeStatus === "FAILED";

  const transcript = useQuery({
    queryKey: ["transcript", lessonId],
    queryFn: () => api.getTranscript(lessonId),
    enabled: Boolean(lessonId) && hasTranscript,
    retry: false,
  });

  const knowledge = useQuery({
    queryKey: ["knowledge", lessonId],
    queryFn: () => api.getKnowledge(lessonId),
    enabled: Boolean(lessonId) && hasKnowledge,
    retry: false,
  });

  const seek = (seconds: number) => {
    setCurrentTime(seconds);
    playerRef.current?.seekTo(seconds);
  };

  if (lesson.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (lesson.isError || !lesson.data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <SoftError message="Não conseguimos abrir esta aula agora. Volte à biblioteca e tente novamente." />
      </div>
    );
  }

  const data = lesson.data;
  const meta = [formatDate(data.createdAt ?? data.updatedAt), formatDuration(data.durationSeconds)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        to="/biblioteca"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Biblioteca
      </Link>

      <header className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="display-title text-2xl leading-tight sm:text-4xl">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <LessonStatus status={data.status} />
            {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/perguntar" search={{ aula: lessonId }}>
            <MessageCircleQuestion className="size-4" />
            <span className="hidden sm:inline">Perguntar sobre esta aula</span>
            <span className="sm:hidden">Perguntar</span>
          </Link>
        </Button>
      </header>

      {data.status === "PROCESSING" || data.status === "PENDING" ? (
        <div className="mt-6">
          <ProcessingIndicator />
        </div>
      ) : null}

      {data.status === "FAILED" ? (
        <div className="mt-6">
          <SoftError message="Esta aula não pôde ser preparada. Você pode enviá-la novamente pela biblioteca." />
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <LessonPlayer
            ref={playerRef}
            videoUrl={data.videoUrl}
            onTimeUpdate={(seconds) => setCurrentTime(seconds)}
          />

          <div className="mt-8">
            <div className="flex gap-1 border-b border-border">
              {(
                [
                  ["resumo", "Resumo"],
                  ["topicos", "Tópicos"],
                  ["transcricao", "Transcrição"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
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
              {tab !== "transcricao" && !hasKnowledge ? (
                <p className="text-sm text-muted-foreground">
                  O resumo desta aula ainda está sendo preparado.
                </p>
              ) : tab !== "transcricao" && knowledge.isLoading ? (
                <LoadingSkeleton rows={2} />
              ) : tab !== "transcricao" && (knowledge.isError || knowledgeFailed) ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível gerar o resumo agora (limite do provedor de IA).
                  A transcrição e a busca ainda podem funcionar.
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
              ) : tab === "topicos" ? (
                (knowledge.data?.topics.length ?? 0) > 0 ? (
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
                )
              ) : !hasTranscript ? (
                <p className="text-sm text-muted-foreground">
                  A transcrição desta aula ainda não está disponível.
                </p>
              ) : (
                <TranscriptList
                  lessonId={lessonId}
                  onSelect={seek}
                  currentTime={currentTime}
                  className="max-h-none"
                />
              )}
            </div>
          </div>
        </div>

        <aside className="hidden min-w-0 lg:block">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Transcrição
          </h2>
          <div className="mt-3">
            {!hasTranscript ? (
              <p className="text-sm text-muted-foreground">
                A transcrição desta aula ainda não está disponível.
              </p>
            ) : (
              <TranscriptList
                lessonId={lessonId}
                onSelect={seek}
                currentTime={currentTime}
                className="max-h-[70vh] overflow-y-auto pr-1"
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );

  function TranscriptList({
    onSelect,
    currentTime: time,
    className,
  }: {
    lessonId: string;
    onSelect: (seconds: number) => void;
    currentTime: number;
    className?: string | undefined;
  }) {
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

    return (
      <div className={cn("space-y-0.5", className)}>
        {segments.map((segment, i) => (
          <TranscriptSegment
            key={`${segment.startSeconds}-${i}`}
            segment={segment}
            active={time >= segment.startSeconds && time < (segment.endSeconds || Infinity)}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }
}
