import { access, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { VideoValidationOptions } from './types';

export class VideoValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'VideoValidationError';
  }
}

export function normalizeExtension(fileName: string): string {
  return extname(fileName).toLowerCase().replace(/^\./, '');
}

export async function assertVideoFile(
  inputPath: string,
  originalName: string,
  options: VideoValidationOptions,
): Promise<{ sizeBytes: number; extension: string }> {
  try {
    await access(inputPath);
  } catch {
    throw new VideoValidationError('Video file does not exist');
  }

  const extension = normalizeExtension(originalName || inputPath);
  if (!options.allowedExtensions.includes(extension)) {
    throw new VideoValidationError(
      `Unsupported video format ".${extension}". Allowed: ${options.allowedExtensions.join(', ')}`,
    );
  }

  const fileStat = await stat(inputPath);
  if (!fileStat.isFile()) {
    throw new VideoValidationError('Path is not a file');
  }

  if (fileStat.size <= 0) {
    throw new VideoValidationError('Video file is empty');
  }

  if (fileStat.size > options.maxBytes) {
    throw new VideoValidationError(
      `Video exceeds max size of ${options.maxBytes} bytes`,
    );
  }

  return {
    sizeBytes: fileStat.size,
    extension,
  };
}
