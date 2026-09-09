FROM node:24-bookworm-slim

WORKDIR /app

# FFmpeg/FFprobe for video ingest. bookworm-slim avoids Alpine codec/friction issues.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
