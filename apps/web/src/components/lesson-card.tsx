import { Link } from '@tanstack/react-router';
import type { Lesson } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';
import { LessonStatus } from './lesson-status';
import { ProcessingIndicator } from './states';

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const date = formatDate(lesson.createdAt ?? lesson.updatedAt);
  const duration = formatDuration(lesson.durationSeconds);
  const meta = [date, duration].filter(Boolean).join(' · ');
  const processing =
    lesson.status === 'PROCESSING' || lesson.status === 'PENDING';
  const progress = lesson.pipeline?.progress;

  return (
    <Link
      to="/aulas/$lessonId"
      params={{ lessonId: lesson.id }}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/35 hover:bg-accent/40"
    >
      <div className="min-w-0">
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
      </div>
      <LessonStatus
        status={lesson.status}
        percent={progress?.percent}
      />
    </Link>
  );
}
