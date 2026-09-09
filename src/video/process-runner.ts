import { spawn } from 'node:child_process';

export class ProcessCommandError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly args: string[],
    readonly exitCode: number | null,
    readonly stderr: string,
    readonly stdout: string = '',
  ) {
    super(message);
    this.name = 'ProcessCommandError';
  }
}

export type RunProcessOptions = {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export async function runProcess(
  command: string,
  args: readonly string[],
  options: RunProcessOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ? { ...process.env, ...options.env } : process.env,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      fn();
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
        settle(() => {
          reject(
            new ProcessCommandError(
              `${command} timed out after ${options.timeoutMs}ms`,
              command,
              [...args],
              null,
              stderr.trim(),
              stdout.trim(),
            ),
          );
        });
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      settle(() => reject(error));
    });

    child.on('close', (code) => {
      settle(() => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new ProcessCommandError(
            `${command} failed with exit code ${code ?? 'unknown'}`,
            command,
            [...args],
            code,
            stderr.trim(),
            stdout.trim(),
          ),
        );
      });
    });
  });
}
