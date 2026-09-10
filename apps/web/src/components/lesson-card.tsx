import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Film, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { api, type Lesson } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';
import { Button } from './ui/button';
import { LessonStatus } from './lesson-status';
import { ProcessingIndicator } from './states';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from '@/lib/utils';

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const date = formatDate(lesson.createdAt ?? lesson.updatedAt);
  const duration = formatDuration(lesson.durationSeconds);
  const meta = [date, duration].filter(Boolean).join(' · ');
  const processing =
    lesson.status === 'PROCESSING' || lesson.status === 'PENDING';
  const progress = lesson.pipeline?.progress;
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lesson.title);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = Boolean(lesson.thumbnailUrl) && !thumbFailed;

  const rename = useMutation({
    mutationFn: () =>
      api.updateLesson(lesson.id, { title: titleDraft.trim() }),
    onSuccess: async () => {
      setRenaming(false);
      setMenuOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteLesson(lesson.id),
    onSuccess: async () => {
      setDeleteOpen(false);
      setMenuOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/35 hover:bg-accent/40 sm:gap-4 sm:px-5 sm:py-4">
      <Link
        to="/aulas/$lessonId"
        params={{ lessonId: lesson.id }}
        className="relative aspect-video w-[4.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-muted/40 sm:w-28"
        aria-label={`Abrir ${lesson.title}`}
        onClick={(e) => {
          if (renaming) e.preventDefault();
        }}
      >
        {showThumb ? (
          <img
            src={lesson.thumbnailUrl!}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Film className="size-5 text-muted-foreground sm:size-6" />
          </span>
        )}
      </Link>

      <Link
        to="/aulas/$lessonId"
        params={{ lessonId: lesson.id }}
        className="min-w-0"
        onClick={(e) => {
          if (renaming) e.preventDefault();
        }}
      >
        {renaming ? (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onClick={(e) => e.preventDefault()}
            onSubmit={(e) => {
              e.preventDefault();
              if (titleDraft.trim()) rename.mutate();
            }}
          >
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={rename.isPending || !titleDraft.trim()}
              >
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRenaming(false);
                  setTitleDraft(lesson.title);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="truncate text-base font-medium text-foreground">
              {lesson.title}
            </h3>
            {meta ? (
              <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
            ) : null}
            {lesson.topics && lesson.topics.length > 0 ? (
              <p className="mt-1.5 truncate text-sm text-muted-foreground">
                {lesson.topics.slice(0, 4).join(' · ')}
              </p>
            ) : null}
            {processing ? (
              <div className="mt-3 max-w-sm">
                <ProcessingIndicator compact progress={progress} />
              </div>
            ) : null}
          </>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <LessonStatus status={lesson.status} percent={progress?.percent} />
        <div className="relative">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            aria-label="Ações da aula"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal className="size-4" />
          </Button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={cn(
                  'absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-md',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => {
                    setTitleDraft(lesson.title);
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="size-3.5" /> Renomear
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5" /> Apagar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (remove.isPending) return;
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent className="border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="display-title text-xl">
              Apagar esta aula?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <p>
                  Você está prestes a remover{' '}
                  <span className="font-medium text-foreground">
                    “{lesson.title}”
                  </span>{' '}
                  da biblioteca.
                </p>
                <ul className="space-y-1.5 border border-border/80 bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed">
                  <li>Vídeo, transcrição e resumo serão apagados</li>
                  <li>O índice de busca desta aula deixa de existir</li>
                  <li>Esta ação não pode ser desfeita</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={remove.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
            >
              {remove.isPending ? 'Apagando…' : 'Apagar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
          {remove.isError ? (
            <p className="text-sm text-destructive">
              {remove.error instanceof Error
                ? remove.error.message
                : 'Não foi possível apagar agora.'}
            </p>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      {rename.isError ? (
        <p className="col-span-3 mt-1 text-xs text-muted-foreground">
          {rename.error instanceof Error
            ? rename.error.message
            : 'Não foi possível concluir a ação.'}
        </p>
      ) : null}
    </div>
  );
}
