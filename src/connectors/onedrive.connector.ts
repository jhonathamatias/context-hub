import { createWriteStream } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { env } from '../config/env';
import { SourceType } from '../database/enums';
import { VideoValidationError } from '../video/file-validation';
import {
  OneDriveGraphResource,
  OneDriveOrigin,
  OneDriveShareKind,
  OneDriveVideoExtension,
} from './onedrive/enums';
import {
  createOneDriveGraphClient,
  graphGet,
  graphGetStream,
  ownedItemApiPath,
  resolveShare,
  shareApiPath,
} from './onedrive/graph';
import type {
  CollectedSourceItem,
  CollectContext,
  SourceConnector,
  SourceConnectorIdentity,
} from './types';

const VIDEO_MIME_PREFIX = 'video/';
const DOWNLOAD_URL_KEY = '@microsoft.graph.downloadUrl';

const ALLOWED_EXTENSIONS = new Set<string>(Object.values(OneDriveVideoExtension));

const MIME_TO_EXTENSION: Record<string, OneDriveVideoExtension> = {
  'video/mp4': OneDriveVideoExtension.Mp4,
  'video/quicktime': OneDriveVideoExtension.Mov,
  'video/webm': OneDriveVideoExtension.Webm,
  'video/x-matroska': OneDriveVideoExtension.Mkv,
  'video/matroska': OneDriveVideoExtension.Mkv,
};

const MIME_HINT_TO_EXTENSION: ReadonlyArray<readonly [string, OneDriveVideoExtension]> =
  [
    ['quicktime', OneDriveVideoExtension.Mov],
    ['mov', OneDriveVideoExtension.Mov],
    ['webm', OneDriveVideoExtension.Webm],
    ['matroska', OneDriveVideoExtension.Mkv],
    ['x-matroska', OneDriveVideoExtension.Mkv],
  ];

export type OneDriveInput = {
  /** Sharing link (onedrive.live.com / sharepoint.com / 1drv.ms). */
  shareUrl: string;
  /** Optional child item id when the share points at a folder. */
  itemId?: string;
  /** Import every video under a shared folder (ignored when itemId is set). */
  importAll?: boolean;
  /** Override env token for private shares. */
  accessToken?: string;
  /** Optional display name for a single-item import (extension preserved). */
  originalName?: string;
};

export type OneDriveListedVideo = {
  id: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  webUrl: string | null;
  thumbnailUrl: string | null;
};

export type OneDrivePlaybackInfo = {
  itemId: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  downloadUrl: string;
};

/** Metadata for deferred download (HTTP returns before bytes arrive). */
export type OneDrivePlannedItem = {
  itemId: string;
  originalName: string;
  expectedBytes: number | null;
  contentType: string | null;
  shareUrl: string;
  extension: string;
};

export type OneDriveDownloadProgress = {
  percent: number;
  bytesReceived: number;
  bytesTotal: number | null;
  status: 'downloading' | 'completed';
};

type ShareListContext = {
  client: Client;
  shareUrl: string;
  root: DriveItem;
  hasToken: boolean;
  resid?: string;
};

const LIST_BY_KIND: Record<
  OneDriveShareKind,
  (ctx: ShareListContext) => Promise<OneDriveListedVideo[]>
> = {
  [OneDriveShareKind.Folder]: async ({
    client,
    shareUrl,
    root,
    hasToken,
    resid,
  }) => {
    const children = await fetchChildren(
      client,
      shareUrl,
      root.id,
      hasToken,
      resid,
    );
    return children.filter(isVideoItem).map(toListedVideo);
  },
  [OneDriveShareKind.Video]: async ({ root }) => [toListedVideo(root)],
  [OneDriveShareKind.Unsupported]: async () => {
    throw new VideoValidationError(
      'OneDrive share is not a video file or a folder containing videos',
    );
  },
};

@Service()
export class OneDriveVideoConnector implements SourceConnector<OneDriveInput> {
  readonly identity: SourceConnectorIdentity = {
    kind: 'onedrive',
    label: 'OneDrive / SharePoint share',
  };

  supports(input: unknown): boolean {
    const candidate = input as Partial<OneDriveInput> | null;
    return typeof candidate?.shareUrl === 'string' && candidate.shareUrl.trim().length > 0;
  }

  async listVideos(
    shareUrl: string,
    options: { accessToken?: string; logger?: FastifyBaseLogger } = {},
  ): Promise<OneDriveListedVideo[]> {
    const hasToken = Boolean(options.accessToken?.trim());
    const resolved = await resolveShare(shareUrl);
    const client = createOneDriveGraphClient(options.accessToken);
    const root = await fetchRootItem(client, resolved, hasToken);
    return LIST_BY_KIND[classifyShare(root)]({
      client,
      shareUrl: resolved.shareUrl,
      root,
      hasToken,
      ...(resolved.resid ? { resid: resolved.resid } : {}),
    });
  }

  /**
   * Resolve a short-lived Graph download URL for in-app video preview
   * (before importing into the pipeline).
   */
  async resolvePlayback(
    input: Pick<OneDriveInput, 'shareUrl' | 'accessToken' | 'itemId'>,
  ): Promise<OneDrivePlaybackInfo> {
    if (!input.itemId?.trim()) {
      throw new VideoValidationError('itemId is required to preview a OneDrive video');
    }
    const resolved = await resolveShare(input.shareUrl);
    const token = input.accessToken ?? env.onedrive.accessToken;
    const hasToken = Boolean(token?.trim());
    const client = createOneDriveGraphClient(token);
    const item = await fetchChildItem(
      client,
      resolved,
      input.itemId,
      hasToken,
    );
    if (!isVideoItem(item)) {
      throw new VideoValidationError('OneDrive item is not a supported video');
    }

    let downloadUrl = readDownloadUrl(item);
    if (!downloadUrl) {
      // Re-fetch the item; list responses sometimes omit @microsoft.graph.downloadUrl.
      const refreshed = await fetchChildItem(
        client,
        resolved,
        input.itemId,
        hasToken,
      );
      downloadUrl = readDownloadUrl(refreshed);
    }
    if (!downloadUrl) {
      throw new VideoValidationError(
        'Não foi possível obter URL de prévia deste vídeo no OneDrive',
      );
    }

    return {
      itemId: item.id ?? input.itemId,
      name: item.name?.trim() || 'video',
      mimeType: item.file?.mimeType ?? null,
      size: item.size ?? null,
      downloadUrl,
    };
  }

  async collect(
    input: OneDriveInput,
    context: CollectContext,
  ): Promise<CollectedSourceItem[]> {
    const planned = await this.planCollect(input, context);
    const resolved = await resolveShare(input.shareUrl);
    const token = input.accessToken ?? env.onedrive.accessToken;
    const hasToken = Boolean(token?.trim());
    const client = createOneDriveGraphClient(token);

    const items: CollectedSourceItem[] = [];
    for (const plan of planned) {
      const item = await fetchChildItem(
        client,
        resolved,
        plan.itemId,
        hasToken,
      );
      items.push(
        await this.downloadItem(
          client,
          resolved.shareUrl,
          item,
          context.logger,
          hasToken,
          resolved.resid,
        ),
      );
    }
    return items;
  }

  /**
   * Resolve which videos will be imported without downloading bytes.
   * Enables returning source ids immediately and tracking download progress.
   */
  async planCollect(
    input: OneDriveInput,
    context: CollectContext,
  ): Promise<OneDrivePlannedItem[]> {
    const resolved = await resolveShare(input.shareUrl);
    const token = input.accessToken ?? env.onedrive.accessToken;
    const hasToken = Boolean(token?.trim());
    const client = createOneDriveGraphClient(token);

    let driveItems: DriveItem[];
    if (input.itemId) {
      driveItems = [
        await fetchChildItem(client, resolved, input.itemId, hasToken),
      ];
    } else {
      const root = await fetchRootItem(client, resolved, hasToken);
      const kind = classifyShare(root);
      if (kind === OneDriveShareKind.Video) {
        driveItems = [root];
      } else if (kind === OneDriveShareKind.Folder) {
        if (!input.importAll) {
          throw new VideoValidationError(
            'Shared link points to a folder. Pass itemId for one video or importAll: true.',
          );
        }
        driveItems = (
          await fetchChildren(
            client,
            resolved.shareUrl,
            root.id,
            hasToken,
            resolved.resid,
          )
        ).filter(isVideoItem);
        if (driveItems.length === 0) {
          throw new VideoValidationError(
            'No video files found in the OneDrive folder',
          );
        }
      } else {
        throw new VideoValidationError(
          'OneDrive share is not a video file or a folder containing videos',
        );
      }
    }

    context.logger.info(
      { count: driveItems.length, connector: OneDriveOrigin.OneDrive },
      'Planned OneDrive videos for deferred ingest',
    );

    return driveItems.map((item) => toPlannedItem(item, resolved.shareUrl));
  }

  async downloadPlannedItem(
    plan: OneDrivePlannedItem,
    options: {
      accessToken?: string;
      logger: FastifyBaseLogger;
      progressPath?: string;
    },
  ): Promise<CollectedSourceItem> {
    const resolved = await resolveShare(plan.shareUrl);
    const token = options.accessToken ?? env.onedrive.accessToken;
    const hasToken = Boolean(token?.trim());
    const client = createOneDriveGraphClient(token);
    const item = await fetchChildItem(
      client,
      resolved,
      plan.itemId,
      hasToken,
    );
    return this.downloadItem(
      client,
      resolved.shareUrl,
      item,
      options.logger,
      hasToken,
      resolved.resid,
      options.progressPath,
    );
  }

  private async downloadItem(
    client: Client,
    shareUrl: string,
    item: DriveItem,
    logger: FastifyBaseLogger,
    hasToken: boolean,
    resid?: string,
    progressPath?: string,
  ): Promise<CollectedSourceItem> {
    const name = item.name?.trim() || 'onedrive-video.mp4';
    const extension = resolveVideoExtension(name, item.file?.mimeType ?? undefined);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new VideoValidationError(
        `Unsupported OneDrive video ".${extension}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      );
    }
    const size = item.size ?? undefined;
    if (size !== undefined && size > env.maxUploadBytes) {
      throw new VideoValidationError(
        `OneDrive file exceeds MAX_UPLOAD_BYTES (${env.maxUploadBytes})`,
      );
    }

    logger.info(
      { name, size: size ?? null, connector: OneDriveOrigin.OneDrive },
      'Downloading OneDrive video',
    );

    const workDir = await mkdtemp(join(env.tempDir, 'onedrive-'));
    const contentPath = join(workDir, `download.${extension}`);
    const stream = await openDownloadStream(
      client,
      shareUrl,
      item,
      hasToken,
      resid,
    );
    await downloadWithProgress(stream, contentPath, {
      expectedBytes: size ?? null,
      progressPath,
    });

    return {
      connectorKind: this.identity.kind,
      sourceType: SourceType.VIDEO,
      originalName: basename(name),
      contentPath,
      contentType: item.file?.mimeType || `video/${extension}`,
      ephemeral: true,
      checkpoint: item.id ?? null,
      version: size !== undefined ? String(size) : null,
      metadata: {
        origin: OneDriveOrigin.OneDrive,
        shareUrl,
        itemId: item.id ?? null,
        webUrl: item.webUrl ?? null,
        extension,
      },
    };
  }
}

async function fetchRootItem(
  client: Client,
  resolved: { shareUrl: string; resid?: string },
  hasToken: boolean,
): Promise<DriveItem> {
  if (hasToken && resolved.resid) {
    try {
      return await fetchDriveItem(
        client,
        ownedItemApiPath(resolved.resid, OneDriveGraphResource.DriveItem),
        { hasToken, prefer: false },
      );
    } catch {
      // Fall through to /shares — resid may be stale after SPO migration.
    }
  }

  return fetchDriveItem(
    client,
    shareApiPath(resolved.shareUrl, OneDriveGraphResource.DriveItem),
    { hasToken },
  );
}

async function fetchChildItem(
  client: Client,
  resolved: { shareUrl: string; resid?: string },
  itemId: string,
  hasToken: boolean,
): Promise<DriveItem> {
  if (hasToken) {
    try {
      return await fetchDriveItem(
        client,
        ownedItemApiPath(itemId, OneDriveGraphResource.DriveItem),
        { hasToken, prefer: false },
      );
    } catch {
      // Fall through to share-scoped item.
    }
  }

  return fetchDriveItem(
    client,
    shareApiPath(resolved.shareUrl, OneDriveGraphResource.DriveItem, itemId),
    { hasToken },
  );
}

async function fetchChildren(
  client: Client,
  shareUrl: string,
  folderId: string | undefined,
  hasToken: boolean,
  resid?: string,
): Promise<DriveItem[]> {
  if (hasToken && (resid || folderId)) {
    try {
      return await fetchChildrenAt(
        client,
        ownedItemApiPath(folderId ?? resid!, OneDriveGraphResource.Children),
        { hasToken, prefer: false },
      );
    } catch {
      // Fall through to /shares children.
    }
  }

  return fetchChildrenAt(
    client,
    shareApiPath(shareUrl, OneDriveGraphResource.Children, folderId),
    { hasToken },
  );
}

async function fetchChildrenAt(
  client: Client,
  path: string,
  options: { hasToken: boolean; prefer?: false },
): Promise<DriveItem[]> {
  try {
    const body = await graphGet<{ value?: DriveItem[] }>(client, path, {
      ...options,
      expand: 'thumbnails',
    });
    return body.value ?? [];
  } catch {
    const body = await graphGet<{ value?: DriveItem[] }>(client, path, options);
    return body.value ?? [];
  }
}

async function fetchDriveItem(
  client: Client,
  path: string,
  options: { hasToken: boolean; prefer?: false },
): Promise<DriveItem> {
  try {
    return await graphGet<DriveItem>(client, path, {
      ...options,
      expand: 'thumbnails',
    });
  } catch {
    return graphGet<DriveItem>(client, path, options);
  }
}

async function openDownloadStream(
  client: Client,
  shareUrl: string,
  item: DriveItem,
  hasToken = false,
  resid?: string,
): Promise<NodeJS.ReadableStream> {
  const preAuthUrl = readDownloadUrl(item);
  if (preAuthUrl) {
    const response = await fetch(preAuthUrl, { redirect: 'follow' });
    if (!response.ok || !response.body) {
      throw new VideoValidationError(
        `OneDrive download failed (${response.status}): ${response.statusText}`,
      );
    }
    const { Readable } = await import('node:stream');
    return Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream,
    );
  }

  if (hasToken && item.id) {
    try {
      return await graphGetStream(
        client,
        ownedItemApiPath(item.id, OneDriveGraphResource.Content),
        { hasToken, prefer: false },
      );
    } catch {
      // Fall through.
    }
  }

  return graphGetStream(
    client,
    shareApiPath(
      shareUrl,
      OneDriveGraphResource.Content,
      item.id ?? resid,
    ),
    { hasToken },
  );
}

function readDownloadUrl(item: DriveItem): string | undefined {
  const record = item as DriveItem & {
    [DOWNLOAD_URL_KEY]?: string;
    additionalData?: Record<string, unknown>;
  };
  const fromFacet = record[DOWNLOAD_URL_KEY];
  const fromAdditional = record.additionalData?.[DOWNLOAD_URL_KEY];
  const candidate = fromFacet ?? fromAdditional;
  return typeof candidate === 'string' ? candidate : undefined;
}

function classifyShare(item: DriveItem): OneDriveShareKind {
  const byShape: Array<[boolean, OneDriveShareKind]> = [
    [Boolean(item.folder), OneDriveShareKind.Folder],
    [isVideoItem(item), OneDriveShareKind.Video],
  ];
  return byShape.find(([match]) => match)?.[1] ?? OneDriveShareKind.Unsupported;
}

function isVideoItem(item: DriveItem): boolean {
  if (item.folder) {
    return false;
  }
  const mime = item.file?.mimeType?.toLowerCase() ?? '';
  const extension = extname(item.name ?? '')
    .replace('.', '')
    .toLowerCase();
  return mime.startsWith(VIDEO_MIME_PREFIX) || ALLOWED_EXTENSIONS.has(extension);
}

function toListedVideo(item: DriveItem): OneDriveListedVideo {
  return {
    id: item.id ?? '',
    name: item.name ?? 'video',
    size: item.size ?? null,
    mimeType: item.file?.mimeType ?? null,
    webUrl: item.webUrl ?? null,
    thumbnailUrl: extractThumbnailUrl(item),
  };
}

function extractThumbnailUrl(item: DriveItem): string | null {
  const record = item as DriveItem & {
    thumbnails?: Array<{
      small?: { url?: string };
      medium?: { url?: string };
      large?: { url?: string };
    }>;
  };
  const set = record.thumbnails?.[0];
  return set?.medium?.url ?? set?.small?.url ?? set?.large?.url ?? null;
}

function toPlannedItem(item: DriveItem, shareUrl: string): OneDrivePlannedItem {
  const name = item.name?.trim() || 'onedrive-video.mp4';
  const extension = resolveVideoExtension(name, item.file?.mimeType ?? undefined);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new VideoValidationError(
      `Unsupported OneDrive video ".${extension}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }
  const size = item.size ?? null;
  if (size !== null && size > env.maxUploadBytes) {
    throw new VideoValidationError(
      `OneDrive file exceeds MAX_UPLOAD_BYTES (${env.maxUploadBytes})`,
    );
  }
  if (!item.id) {
    throw new VideoValidationError('OneDrive item is missing an id');
  }
  return {
    itemId: item.id,
    originalName: basename(name),
    expectedBytes: size,
    contentType: item.file?.mimeType ?? `video/${extension}`,
    shareUrl,
    extension,
  };
}

async function downloadWithProgress(
  stream: NodeJS.ReadableStream,
  contentPath: string,
  options: {
    expectedBytes: number | null;
    progressPath?: string | undefined;
  },
): Promise<void> {
  let received = 0;
  let lastWriteAt = 0;

  const writeProgress = async (
    status: OneDriveDownloadProgress['status'],
  ): Promise<void> => {
    if (!options.progressPath) {
      return;
    }
    const total = options.expectedBytes;
    const percent =
      total && total > 0
        ? Math.min(99, Math.round((received / total) * 100))
        : status === 'completed'
          ? 100
          : Math.min(95, Math.round(received / (1024 * 1024))); // MB heuristic
    const payload: OneDriveDownloadProgress = {
      percent: status === 'completed' ? 100 : percent,
      bytesReceived: received,
      bytesTotal: total,
      status,
    };
    await writeFile(options.progressPath, JSON.stringify(payload), 'utf8');
  };

  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      const now = Date.now();
      if (now - lastWriteAt >= 400) {
        lastWriteAt = now;
        void writeProgress('downloading');
      }
      callback(null, chunk);
    },
  });

  await writeProgress('downloading');
  await pipeline(stream, counter, createWriteStream(contentPath));
  await writeProgress('completed');
}

function resolveVideoExtension(
  name: string,
  mimeType?: string,
): OneDriveVideoExtension {
  const fromName = extname(name).replace('.', '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName as OneDriveVideoExtension;
  }

  const normalizedMime = mimeType?.toLowerCase() ?? '';
  return (
    MIME_TO_EXTENSION[normalizedMime] ??
    MIME_HINT_TO_EXTENSION.find(([hint]) => normalizedMime.includes(hint))?.[1] ??
    OneDriveVideoExtension.Mp4
  );
}
