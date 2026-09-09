import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
let building = false;
let queued = false;

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

async function build(): Promise<void> {
  if (building) {
    queued = true;
    return;
  }

  building = true;
  try {
    do {
      queued = false;
      const code = await run('pnpm', ['build']);
      if (code !== 0) {
        console.error('Build failed');
      }
    } while (queued);
  } finally {
    building = false;
  }
}

await build();

const worker = spawn('node', ['--watch', 'dist/worker.js'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

watch(resolve(root, 'src'), { recursive: true }, (_event, filename) => {
  if (!filename?.endsWith('.ts')) {
    return;
  }
  void build();
});

process.on('SIGINT', () => {
  worker.kill('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  worker.kill('SIGTERM');
  process.exit(0);
});
