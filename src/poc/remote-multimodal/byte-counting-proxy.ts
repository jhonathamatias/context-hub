import { createReadStream, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

export type ByteCountingProxy = {
  url: string;
  port: number;
  getTransferredBytes: () => number;
  resetTransferredBytes: () => void;
  close: () => Promise<void>;
};

export type ProxySource =
  | { kind: 'remote'; url: string }
  | { kind: 'local-file'; path: string };

/**
 * Tiny HTTP proxy that counts response body bytes delivered to the client.
 * Supports Range for local files and forwards Range to remote upstreams.
 * Used to measure what FFmpeg actually transfers during seek/extract.
 */
export async function startByteCountingProxy(
  source: ProxySource,
): Promise<ByteCountingProxy> {
  let transferred = 0;

  const server = createServer(async (req, res) => {
    try {
      if (source.kind === 'local-file') {
        await serveLocalFile(source.path, req, res, (n) => {
          transferred += n;
        });
        return;
      }
      await serveRemote(source.url, req, res, (n) => {
        transferred += n;
      });
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end(
          error instanceof Error ? error.message : 'proxy upstream error',
        );
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind byte-counting proxy');
  }

  return {
    url: `http://127.0.0.1:${address.port}/video.mp4`,
    port: address.port,
    getTransferredBytes: () => transferred,
    resetTransferredBytes: () => {
      transferred = 0;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function serveLocalFile(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  onBytes: (n: number) => void,
): Promise<void> {
  const stat = statSync(path);
  const size = stat.size;
  const range = parseRange(req.headers.range, size);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');

  if (!range) {
    res.statusCode = 200;
    res.setHeader('Content-Length', String(size));
    await pipeCounted(createReadStream(path), res, onBytes);
    return;
  }

  const { start, end } = range;
  res.statusCode = 206;
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  res.setHeader('Content-Length', String(end - start + 1));
  await pipeCounted(
    createReadStream(path, { start, end }),
    res,
    onBytes,
  );
}

async function serveRemote(
  upstreamUrl: string,
  req: IncomingMessage,
  res: ServerResponse,
  onBytes: (n: number) => void,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (typeof req.headers.range === 'string') {
    headers.Range = req.headers.range;
  }

  const upstream = await fetch(upstreamUrl, {
    headers,
    redirect: 'follow',
  });

  res.statusCode = upstream.status;
  const passHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
  ];
  for (const key of passHeaders) {
    const value = upstream.headers.get(key);
    if (value) res.setHeader(key, value);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(
    upstream.body as import('node:stream/web').ReadableStream,
  );
  await pipeCounted(nodeStream, res, onBytes);
}

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(header);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

function pipeCounted(
  source: NodeJS.ReadableStream,
  res: ServerResponse,
  onBytes: (n: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    source.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      onBytes(buf.length);
    });
    source.on('error', reject);
    res.on('error', reject);
    res.on('finish', () => resolve());
    source.pipe(res);
  });
}
