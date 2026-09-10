#!/usr/bin/env python3
"""Local open-source transcription via faster-whisper (not a paid API)."""

from __future__ import annotations

import argparse
import json
import sys
import time
import wave
from pathlib import Path


def audio_duration_seconds(path: str) -> float | None:
    try:
        with wave.open(path, "rb") as handle:
            frames = handle.getnframes()
            rate = handle.getframerate()
            if rate <= 0:
                return None
            return frames / float(rate)
    except Exception:
        return None


def write_progress(
    path: Path,
    *,
    percent: float,
    position: float,
    duration: float | None,
    segments: int,
    status: str,
) -> None:
    payload = {
        "status": status,
        "percent": round(max(0.0, min(100.0, percent)), 1),
        "positionSeconds": round(position, 2),
        "durationSeconds": round(duration, 2) if duration else None,
        "segments": segments,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    print(json.dumps({"progress": payload}), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("--audio", required=True, help="Path to audio file")
    parser.add_argument("--output", required=True, help="Path to write JSON output")
    parser.add_argument("--model", default="tiny", help="Whisper model size")
    parser.add_argument("--device", default="cpu", help="cpu or cuda")
    parser.add_argument(
        "--language",
        default=None,
        help="Optional language code (e.g. pt). Omit for auto-detect.",
    )
    parser.add_argument(
        "--initial_prompt",
        default=None,
        help="Optional initial prompt / glossary for Whisper decoding bias.",
    )
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print(f"faster-whisper is not installed: {exc}", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    progress_path = output_path.with_name("progress.json")
    duration = audio_duration_seconds(args.audio)

    write_progress(
        progress_path,
        percent=1.0,
        position=0.0,
        duration=duration,
        segments=0,
        status="starting",
    )

    compute_type = "int8" if args.device == "cpu" else "float16"
    model = WhisperModel(args.model, device=args.device, compute_type=compute_type)

    transcribe_kwargs: dict = {"vad_filter": True}
    if args.language:
        transcribe_kwargs["language"] = args.language
    if args.initial_prompt:
        transcribe_kwargs["initial_prompt"] = args.initial_prompt

    segments_iter, info = model.transcribe(args.audio, **transcribe_kwargs)

    write_progress(
        progress_path,
        percent=2.0,
        position=0.0,
        duration=duration,
        segments=0,
        status="transcribing",
    )

    segments = []
    texts = []
    last_write = 0.0
    position = 0.0

    for segment in segments_iter:
        text = (segment.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": text,
            }
        )
        texts.append(text)
        position = float(segment.end)
        now = time.monotonic()
        if now - last_write >= 1.5 or len(segments) == 1:
            if duration and duration > 0:
                percent = min(99.0, max(2.0, (position / duration) * 100.0))
            else:
                percent = min(99.0, 2.0 + len(segments) * 0.5)
            write_progress(
                progress_path,
                percent=percent,
                position=position,
                duration=duration,
                segments=len(segments),
                status="transcribing",
            )
            last_write = now

    payload = {
        "language": info.language,
        "language_probability": getattr(info, "language_probability", None),
        "text": " ".join(texts).strip(),
        "segments": segments,
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    write_progress(
        progress_path,
        percent=100.0,
        position=duration or position,
        duration=duration,
        segments=len(segments),
        status="done",
    )
    print(json.dumps({"ok": True, "output": args.output}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
