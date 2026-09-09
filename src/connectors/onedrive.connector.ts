import { createWriteStream } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
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
};

export type OneDriveListedVideo = {
  id: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  webUrl: string | null;
};

type ShareListContext = {
  client: Client;
  shareUrl: string;
  root: DriveItem;
};

type ShareCollectContext = ShareListContext & {
  input: OneDriveInput;
  logger: FastifyBaseLogger;
  download: (item: DriveItem) => Promise<CollectedSourceItem>;
};

const LIST_BY_KIND: Record<
  OneDriveShareKind,
  (ctx: ShareListContext) => Promise<OneDriveListedVideo[]>
> = {
  [OneDriveShareKind.Folder]: async ({ client, shareUrl, root }) => {
    const children = await fetchChildren(client, shareUrl, root.id);
    return children.filter(isVideoItem).map(toListedVideo);
  },
  [OneDriveShareKind.Video]: async ({ root }) => [toListedVideo(root)],
  [OneDriveShareKind.Unsupported]: async () => {
    throw new VideoValidationError(
      'OneDrive share is not a video file or a folder containing videos',
    );
  },
};

const COLLECT_BY_KIND: Record<
  OneDriveShareKind,
  (ctx: ShareCollectContext) => Promise<CollectedSourceItem[]>
> = {
  [OneDriveShareKind.Folder]: async ({
    client,
    shareUrl,
    root,
    input,
    download,
  }) => {
    if (!input.importAll) {
      throw new VideoValidationError(
        'Shared link points to a folder. Pass itemId for one video or importAll: true.',
      );
    }

    const videos = (await fetchChildren(client, shareUrl, root.id)).filter(
      isVideoItem,
    );
    if (videos.length === 0) {
      throw new VideoValidationError('No video files found in the OneDrive folder');
    }

    return Promise.all(videos.map((video) => download(video)));
  },
  [OneDriveShareKind.Video]: async ({ root, download }) => [await download(root)],
  [OneDriveShareKind.Unsupported]: async ({ root }) => {
    throw new VideoValidationError(
      `OneDrive item "${root.name ?? 'unknown'}" is not a supported video`,
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
    const client = createOneDriveGraphClient(options.accessToken);
    const root = await fetchDriveItem(client, shareUrl);
    return LIST_BY_KIND[classifyShare(root)]({ client, shareUrl, root });
  }

  async collect(
    input: OneDriveInput,
    context: CollectContext,
  ): Promise<CollectedSourceItem[]> {
    const shareUrl = input.shareUrl.trim();
    const token = input.accessToken ?? env.onedrive.accessToken;
    const client = createOneDriveGraphClient(token);
    const download = (item: DriveItem) =>
      this.downloadItem(client, shareUrl, item, context.logger);

    if (input.itemId) {
      const item = await fetchDriveItem(client, shareUrl, input.itemId);
      return [await download(item)];
    }

    const root = await fetchDriveItem(client, shareUrl);
    return COLLECT_BY_KIND[classifyShare(root)]({
      client,
      shareUrl,
      root,
      input,
      logger: context.logger,
      download,
    });
  }

  private async downloadItem(
    client: Client,
    shareUrl: string,
    item: DriveItem,
    logger: FastifyBaseLogger,
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
    const stream = await openDownloadStream(client, shareUrl, item);
    await pipeline(stream, createWriteStream(contentPath));

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

async function fetchDriveItem(
  client: Client,
  shareUrl: string,
  itemId?: string,
): Promise<DriveItem> {
  return graphGet<DriveItem>(
    client,
    shareApiPath(shareUrl, OneDriveGraphResource.DriveItem, itemId),
  );
}

async function fetchChildren(
  client: Client,
  shareUrl: string,
  folderId?: string,
): Promise<DriveItem[]> {
  const body = await graphGet<{ value?: DriveItem[] }>(
    client,
    shareApiPath(shareUrl, OneDriveGraphResource.Children, folderId),
  );
  return body.value ?? [];
}

async function openDownloadStream(
  client: Client,
  shareUrl: string,
  item: DriveItem,
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

  return graphGetStream(
    client,
    shareApiPath(shareUrl, OneDriveGraphResource.Content, item.id),
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
  };
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
