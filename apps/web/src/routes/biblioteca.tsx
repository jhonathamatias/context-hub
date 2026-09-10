import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { api, type LessonStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonCard } from "@/components/lesson-card";
import { AddLessonDialog } from "@/components/add-lesson-dialog";
import { EmptyState, LoadingSkeleton, SoftError } from "@/components/states";
import { PageFrame, PageFrameWidth } from "@/components/page-frame";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Context Hub" },
      { name: "description", content: "Todas as suas aulas organizadas em um só lugar." },
      { property: "og:title", content: "Biblioteca — Context Hub" },
      {
        property: "og:description",
        content: "Todas as suas aulas organizadas em um só lugar.",
      },
    ],
  }),
  component: LibraryPage,
});

type Filter = "all" | LessonStatus;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "READY", label: "Processadas" },
  { key: "PROCESSING", label: "Processando" },
  { key: "FAILED", label: "Com erro" },
];

function LibraryPage() {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const lessons = useQuery({
    queryKey: ["lessons"],
    queryFn: api.listLessons,
    retry: false,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((l) => l.status === "PENDING" || l.status === "PROCESSING")
        ? 3000
        : false,
  });

  const visible = useMemo(() => {
    const list = lessons.data ?? [];
    return list.filter((lesson) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "PROCESSING"
            ? lesson.status === "PROCESSING" || lesson.status === "PENDING"
            : lesson.status === filter;
      const matchesTerm =
        !term.trim() ||
        lesson.title.toLowerCase().includes(term.trim().toLowerCase()) ||
        (lesson.topics ?? []).some((t) => t.toLowerCase().includes(term.trim().toLowerCase()));
      return matchesFilter && matchesTerm;
    });
  }, [lessons.data, filter, term]);

  return (
    <PageFrame width={PageFrameWidth.Xl}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="display-title text-2xl sm:text-3xl">Biblioteca</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lessons.data ? `${lessons.data.length} aulas` : "Suas aulas gravadas"}
          </p>
        </div>
        <AddLessonDialog
          trigger={
            <Button className="shrink-0">
              <Plus className="size-4" /> Adicionar aula
            </Button>
          }
        />
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar aula…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filter === f.key
                  ? "border-primary/40 bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {lessons.isLoading ? (
          <LoadingSkeleton />
        ) : lessons.isError ? (
          <SoftError message="Não conseguimos carregar sua biblioteca agora. Verifique se o Context Hub está rodando e tente novamente." />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nenhuma aula por aqui"
            description="Adicione um vídeo de aula e ele ficará pesquisável em poucos minutos."
            action={<AddLessonDialog trigger={<Button>Adicionar aula</Button>} />}
          />
        ) : (
          visible.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)
        )}
      </div>
    </PageFrame>
  );
}
