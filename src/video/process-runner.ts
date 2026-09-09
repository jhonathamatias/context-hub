import { spawn } from 'node:child_process';

export class ProcessCommandError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly args: string[],
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'ProcessCommandError';
  }
}

export async function runProcess(
  command: string,
  args: readonly string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
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
        ),
      );
    });
  });
}
