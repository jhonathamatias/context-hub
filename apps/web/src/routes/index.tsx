import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonCard } from "@/components/lesson-card";
import { AddLessonDialog } from "@/components/add-lesson-dialog";
import { EmptyState, LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Context Hub" },
      {
        name: "description",
        content: "Encontre em segundos qualquer coisa que você já aprendeu nas suas aulas.",
      },
      { property: "og:title", content: "Início — Context Hub" },
      {
        property: "og:description",
        content: "Encontre em segundos qualquer coisa que você já aprendeu nas suas aulas.",
      },
    ],
  }),
  component: HomePage,
});

const examples = ["Tríades", "Pentatônica", "Improvisação", "Outside", "Arpejos"];

function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const lessons = useQuery({ queryKey: ["lessons"], queryFn: api.listLessons, retry: false });
  const all = lessons.data ?? [];
  const ready = all.filter((l) => l.status === "READY");

  const goSearch = (q: string) => {
    if (!q.trim()) return;
    void navigate({ to: "/buscar", search: { q: q.trim() } });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <section className="text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="bg-accent-gradient size-1.5 rounded-full" />
          Seu acervo de aulas, pesquisável
        </p>
        <h1 className="display-title text-4xl leading-[1.1] sm:text-5xl">
          Encontre qualquer coisa
          <br />
          <span className="text-gradient">que você já aprendeu.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Pesquise em suas aulas ou pergunte diretamente ao seu acervo.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            goSearch(query);
          }}
          className="mt-8"
        >
          <div className="panel flex items-center gap-2 px-4 py-3 focus-within:ring-glow">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busque por um assunto, técnica ou conceito…"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" className="shrink-0">
              Buscar
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => {
                setQuery(example);
                goSearch(example);
              }}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link to="/perguntar" className="inline-flex items-center gap-1 text-primary">
            Perguntar às minhas aulas <ArrowRight className="size-3.5" />
          </Link>
          <AddLessonDialog
            trigger={
              <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Plus className="size-4" /> Adicionar aula
              </button>
            }
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Continuar estudando
        </h2>
        <div className="mt-4 space-y-3">
          {lessons.isLoading ? (
            <LoadingSkeleton rows={2} />
          ) : ready.length > 0 ? (
            ready.slice(0, 3).map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)
          ) : (
            <EmptyState
              title="Nenhuma aula pronta ainda"
              description="Adicione sua primeira aula para começar a pesquisar dentro do que você já estudou."
              action={<AddLessonDialog trigger={<Button>Adicionar aula</Button>} />}
            />
          )}
        </div>
      </section>

      {all.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Aulas recentes
            </h2>
            <Link to="/biblioteca" className="text-sm text-primary">
              Ver biblioteca
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {all.slice(0, 5).map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
