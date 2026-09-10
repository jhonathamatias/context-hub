import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Film,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type LessonPlayerHandle = {
  seekTo: (seconds: number) => void;
  currentTime: () => number;
};

type LessonPlayerProps = {
  videoUrl?: string | null | undefined;
  posterUrl?: string | null | undefined;
  onTimeUpdate?: ((seconds: number) => void) | undefined;
  className?: string | undefined;
};

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Studio lesson player — native video + custom CapCut-like controls.
 */
export const LessonPlayer = forwardRef<LessonPlayerHandle, LessonPlayerProps>(
  function LessonPlayer({ videoUrl, posterUrl, onTimeUpdate, className }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hideTimer = useRef<number | null>(null);

    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [rate, setRate] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [chromeVisible, setChromeVisible] = useState(true);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const el = videoRef.current;
        if (!el) return;
        el.currentTime = seconds;
        void el.play().catch(() => undefined);
      },
      currentTime: () => videoRef.current?.currentTime ?? 0,
    }));

    const bumpChrome = useCallback(() => {
      setChromeVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          setChromeVisible(false);
        }
      }, 2200);
    }, []);

    useEffect(() => {
      return () => {
        if (hideTimer.current) window.clearTimeout(hideTimer.current);
      };
    }, []);

    useEffect(() => {
      const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener('fullscreenchange', onFs);
      return () => document.removeEventListener('fullscreenchange', onFs);
    }, []);

    const togglePlay = () => {
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) void el.play().catch(() => undefined);
      else el.pause();
      bumpChrome();
    };

    const seekBy = (delta: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = Math.min(
        el.duration || 0,
        Math.max(0, el.currentTime + delta),
      );
      bumpChrome();
    };

    const seekToRatio = (ratio: number) => {
      const el = videoRef.current;
      if (!el || !el.duration) return;
      el.currentTime = Math.min(1, Math.max(0, ratio)) * el.duration;
      bumpChrome();
    };

    const cycleRate = () => {
      const el = videoRef.current;
      if (!el) return;
      const idx = RATES.indexOf(rate as (typeof RATES)[number]);
      const next = RATES[(idx + 1) % RATES.length] ?? 1;
      el.playbackRate = next;
      setRate(next);
      bumpChrome();
    };

    const toggleMute = () => {
      const el = videoRef.current;
      if (!el) return;
      el.muted = !el.muted;
      setMuted(el.muted);
      bumpChrome();
    };

    const setVolumeValue = (value: number) => {
      const el = videoRef.current;
      if (!el) return;
      const v = Math.min(1, Math.max(0, value));
      el.volume = v;
      el.muted = v === 0;
      setVolume(v);
      setMuted(v === 0);
      bumpChrome();
    };

    const toggleFullscreen = async () => {
      const root = rootRef.current;
      if (!root) return;
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await root.requestFullscreen();
      } catch {
        // Browser may block fullscreen without gesture.
      }
      bumpChrome();
    };

    const progress = duration > 0 ? current / duration : 0;
    const showChrome = chromeVisible || !playing;
    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    if (!videoUrl) {
      return (
        <div
          className={cn(
            'flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 text-center',
            className,
          )}
        >
          <Film className="size-6 text-muted-foreground" />
          <p className="max-w-xs px-6 text-sm text-muted-foreground">
            Vídeo ainda não disponível para esta aula.
          </p>
        </div>
      );
    }

    return (
      <div
        ref={rootRef}
        className={cn(
          'lesson-player group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black',
          className,
        )}
        onMouseMove={bumpChrome}
        onMouseLeave={() => {
          if (playing) setChromeVisible(false);
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl || undefined}
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-contain"
          onClick={togglePlay}
          onPlay={() => {
            setPlaying(true);
            bumpChrome();
          }}
          onPause={() => {
            setPlaying(false);
            setChromeVisible(true);
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrent(t);
            onTimeUpdate?.(t);
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            setVolume(e.currentTarget.volume);
            setMuted(e.currentTarget.muted);
            setRate(e.currentTarget.playbackRate || 1);
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onProgress={(e) => {
            const el = e.currentTarget;
            if (!el.duration || el.buffered.length === 0) return;
            setBuffered(el.buffered.end(el.buffered.length - 1) / el.duration);
          }}
          onVolumeChange={(e) => {
            setVolume(e.currentTarget.volume);
            setMuted(e.currentTarget.muted);
          }}
        />

        {/* Center play — only when paused */}
        {!playing ? (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-black/70"
            aria-label="Reproduzir"
          >
            <Play className="size-6 fill-white pl-0.5" />
          </button>
        ) : null}

        {/* Bottom chrome */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-200',
            showChrome ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {/* Scrubber */}
          <div
            className="group/scrub relative mb-2 h-5 cursor-pointer"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seekToRatio(ratio);

              const move = (ev: PointerEvent) => {
                const r = (ev.clientX - rect.left) / rect.width;
                seekToRatio(r);
              };
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/scrub:h-1.5">
              <div
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: `${buffered * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-primary"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition group-hover/scrub:opacity-100"
              style={{ left: `${progress * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-1">
            <div className="flex min-w-0 items-center gap-0.5">
              <IconButton
                label={playing ? 'Pausar' : 'Reproduzir'}
                onClick={togglePlay}
              >
                {playing ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 fill-current pl-px" />
                )}
              </IconButton>
              <IconButton label="Voltar 10s" onClick={() => seekBy(-10)}>
                <RotateCcw className="size-4" />
              </IconButton>
              <IconButton label="Avançar 10s" onClick={() => seekBy(10)}>
                <RotateCw className="size-4" />
              </IconButton>
              <span className="ml-1 whitespace-nowrap px-1.5 font-mono text-[11px] tabular-nums text-white/80">
                {formatClock(current)} / {formatClock(duration)}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-0.5">
              <IconButton
                label={muted ? 'Ativar som' : 'Silenciar'}
                onClick={toggleMute}
              >
                <VolumeIcon className="size-4" />
              </IconButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => setVolumeValue(Number(e.target.value))}
                className="lesson-player__vol hidden w-20 sm:block"
              />
              <button
                type="button"
                onClick={cycleRate}
                className="rounded-md px-2 py-1.5 text-[11px] font-semibold tabular-nums text-white/85 transition hover:bg-white/10 hover:text-white"
                aria-label="Velocidade de reprodução"
              >
                {rate === 1 ? '1x' : `${rate}x`}
              </button>
              <IconButton
                label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen ? (
                  <Minimize className="size-4" />
                ) : (
                  <Maximize className="size-4" />
                )}
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/90 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
