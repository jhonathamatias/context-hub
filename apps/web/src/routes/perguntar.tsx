import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { SendHorizontal } from "lucide-react";
import { api, type ChatAnswer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format";
import { EmptyState, SoftError } from "@/components/states";
import { PageFrame, PageFrameWidth } from "@/components/page-frame";

type SearchParams = { aula?: string };

export const Route = createFileRoute("/perguntar")({
  validateSearch: (search: Record<string, unknown>): SearchParams =>
    typeof search["aula"] === "string" && search["aula"] ? { aula: search["aula"] } : {},
  head: () => ({
    meta: [
      { title: "Pergunte às suas aulas — Context Hub" },
      {
        name: "description",
        content: "Faça uma pergunta e receba a resposta com as aulas de origem.",
      },
      { property: "og:title", content: "Pergunte às suas aulas — Context Hub" },
      {
        property: "og:description",
        content: "Faça uma pergunta e receba a resposta com as aulas de origem.",
      },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  const { aula } = Route.useSearch();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");

  const ask = useMutation<ChatAnswer, Error, string>({
    mutationFn: (q: string) => api.ask(q, aula),
  });

  const answer = ask.data;

  return (
    <PageFrame width={PageFrameWidth.Lg}>
      <h1 className="display-title text-2xl sm:text-3xl">Pergunte às suas aulas</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {aula
          ? "Respondo usando somente esta aula."
          : "Faça uma pergunta e eu procuro a resposta no conteúdo que você estudou."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          setAsked(question.trim());
          ask.mutate(question.trim());
        }}
        className="mt-4"
      >
        <div className="rounded-xl border border-border bg-card p-2.5 focus-within:border-primary/50">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Ex: Como ele recomenda estudar improvisação?"
            className="w-full resize-none bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={ask.isPending || !question.trim()}>
              {ask.isPending ? "Procurando…" : "Perguntar"}
              <SendHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-4">
        {ask.isPending ? (
          <p className="animate-pulse text-sm text-muted-foreground">
            Procurando nas suas aulas…
          </p>
        ) : ask.isError ? (
          <SoftError message="Não consegui responder agora. Tente novamente em instantes." />
        ) : answer ? (
          <article className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{asked}</p>
              {answer.answer.trim() ? (
                <div className="mt-2 space-y-3 text-[17px] leading-relaxed">
                  {answer.answer.split(/\n{2,}/).map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[17px] leading-relaxed text-muted-foreground">
                  Não encontrei conteúdo suficiente nas suas aulas para responder isso.
                </p>
              )}
            </div>

            {answer.references.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Fontes
                </h2>
                <div className="mt-2 space-y-2">
                  {answer.references.map((ref, i) => (
                    <Link
                      key={`${ref.lessonId}-${i}`}
                      to="/aulas/$lessonId"
                      params={{ lessonId: ref.lessonId }}
                      search={{ t: Math.floor(ref.startSeconds) }}
                      className="block rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/30"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-medium">{ref.lessonTitle}</span>
                        <span className="font-mono text-xs tabular-nums text-primary">
                          {formatTimestamp(ref.startSeconds)}
                          {ref.endSeconds > ref.startSeconds
                            ? ` — ${formatTimestamp(ref.endSeconds)}`
                            : ""}
                        </span>
                      </div>
                      {ref.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          “{ref.excerpt}”
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ) : (
          <EmptyState
            title="Pergunte como você falaria com seu professor"
            description="“Como estudar pentatônica?”, “onde ele falou de target notes?” — respondo citando as aulas."
          />
        )}
      </div>
    </PageFrame>
  );
}
