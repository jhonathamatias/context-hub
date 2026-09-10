import { spawn, type ChildProcess } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const DEBOUNCE_MS = 400;

let building = false;
let queued = false;
let debounceTimer: NodeJS.Timeout | undefined;
let worker: ChildProcess | undefined;

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolvePromise(code ?? 1));
  });
}

async function build(): Promise<boolean> {
  if (building) {
    queued = true;
    return false;
  }

  building = true;
  let ok = true;
  try {
    do {
      queued = false;
      const code = await run('pnpm', ['build']);
      if (code !== 0) {
        console.error('Build failed');
        ok = false;
      }
    } while (queued);
  } finally {
    building = false;
  }
  return ok;
}

function startWorker(): void {
  if (worker && !worker.killed) {
    worker.kill('SIGTERM');
  }
  // Do NOT use `node --watch` on dist/: every tsc emit would SIGTERM mid-whisper.
  worker = spawn('node', ['dist/worker.js'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  worker.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.error(`Worker exited (code=${code}, signal=${signal})`);
    }
  });
}

function scheduleRebuild(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    void (async () => {
      const ok = await build();
      if (ok) {
        startWorker();
      }
    })();
  }, DEBOUNCE_MS);
}

const initialOk = await build();
if (!initialOk) {
  process.exit(1);
}
startWorker();

watch(resolve(root, 'src'), { recursive: true }, (_event, filename) => {
  if (!filename?.endsWith('.ts')) {
    return;
  }
  scheduleRebuild();
});

function shutdown(signal: NodeJS.Signals): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  worker?.kill(signal);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
