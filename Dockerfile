FROM node:24-bookworm-slim

WORKDIR /app

# FFmpeg/FFprobe for video ingest + Python for local open-source Whisper.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    espeak-ng \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY python/requirements.txt /tmp/whisper-requirements.txt
RUN python3 -m venv /opt/whisper-venv \
  && /opt/whisper-venv/bin/pip install --no-cache-dir -U pip \
  && /opt/whisper-venv/bin/pip install --no-cache-dir -r /tmp/whisper-requirements.txt \
  && /opt/whisper-venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('tiny', device='cpu', compute_type='int8')"

COPY . .

ENV WHISPER_PYTHON_PATH=/opt/whisper-venv/bin/python
ENV WHISPER_SCRIPT_PATH=/app/python/transcribe.py
ENV WHISPER_MODEL=tiny
ENV WHISPER_DEVICE=cpu

EXPOSE 3000

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
