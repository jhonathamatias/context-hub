#!/usr/bin/env python3
"""Local open-source transcription via faster-whisper (not a paid API)."""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("--audio", required=True, help="Path to audio file")
    parser.add_argument("--output", required=True, help="Path to write JSON output")
    parser.add_argument("--model", default="tiny", help="Whisper model size")
    parser.add_argument("--device", default="cpu", help="cpu or cuda")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print(f"faster-whisper is not installed: {exc}", file=sys.stderr)
        return 1

    compute_type = "int8" if args.device == "cpu" else "float16"
    model = WhisperModel(args.model, device=args.device, compute_type=compute_type)
    segments_iter, info = model.transcribe(args.audio, vad_filter=True)

    segments = []
    texts = []
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

    payload = {
        "language": info.language,
        "language_probability": getattr(info, "language_probability", None),
        "text": " ".join(texts).strip(),
        "segments": segments,
    }

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "output": args.output}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
