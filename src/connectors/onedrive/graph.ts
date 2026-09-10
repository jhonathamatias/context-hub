import {
  Client,
  GraphError,
  HTTPMessageHandler,
  RedirectHandler,
  RedirectHandlerOptions,
  RetryHandler,
  RetryHandlerOptions,
  TelemetryHandler,
} from '@microsoft/microsoft-graph-client';
import { VideoValidationError } from '../../video/file-validation';
import { GraphHttpStatus, OneDriveGraphResource } from './enums';

/** Peek-only redeem — avoids durable write on consumer OneDrive (can hit serviceReadOnly). */
const PREFER_REDEEM = 'redeemSharingLinkIfNecessary';

const FILES_SCOPE_HINT =
  'No Graph Explorer: Modify permissions → marque Files.Read e Files.Read.All → Consent → copie um token novo e salve de novo na integração.';

const NOT_FOUND_HINT =
  'No OneDrive, abra a pasta/arquivo → Compartilhar → copie um link novo (preferencialmente “qualquer pessoa com o link”) e cole aqui de novo.';

/** IIS rejects Graph paths when the encoded share URL is enormous (photos UI redirects). */
const MAX_SHARE_URL_CHARS = 400;

export type ResolvedShare = {
  /** URL safe to encode for `/shares/{u!…}` — keep short 1drv.ms when redirect is unusable. */
  shareUrl: string;
  /** Drive item id from redirect/query when available (owner shortcut). */
  resid?: string;
};

/**
 * Graph client for OneDrive shares.
 * With a token: default auth middleware.
 * Without: retry/redirect/telemetry only — public redeemSharingLink shares work anonymously.
 */
export function createOneDriveGraphClient(accessToken?: string): Client {
  const token = normalizeAccessToken(accessToken);
  if (token) {
    return Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });
  }

  const http = new HTTPMessageHandler();
  const telemetry = new TelemetryHandler();
  telemetry.setNext(http);
  const redirect = new RedirectHandler(new RedirectHandlerOptions());
  redirect.setNext(telemetry);
  const retry = new RetryHandler(new RetryHandlerOptions());
  retry.setNext(redirect);

  return Client.initWithMiddleware({ middleware: retry });
}

/** Strip "Bearer ", whitespace and accidental newlines from pasted Graph Explorer tokens. */
export function normalizeAccessToken(
  token: string | null | undefined,
): string | undefined {
  if (!token) return undefined;
  const cleaned = token
    .replace(/^\s*Bearer\s+/i, '')
    .replace(/[\r\n\t]+/g, '')
    .trim();
  return cleaned || undefined;
}

/**
 * Ensures the token can read OneDrive files (User.Read alone is not enough).
 * Graph Explorer defaults often only consent User.Read → /me works, /me/drive fails.
 */
export async function assertGraphFilesAccess(accessToken: string): Promise<void> {
  const token = normalizeAccessToken(accessToken);
  if (!token) {
    throw new VideoValidationError('Access token vazio.');
  }

  const client = createOneDriveGraphClient(token);

  try {
    await client.api('/me').get();
  } catch (error) {
    throw toOneDriveValidationError(error, { hasToken: true, phase: 'identity' });
  }

  try {
    await client.api('/me/drive').get();
  } catch (error) {
    throw toOneDriveValidationError(error, { hasToken: true, phase: 'files' });
  }
}

/**
 * Normalize a pasted OneDrive URL for Graph.
 * Follows 1drv.ms redirects only to extract `resid` — never encodes the photos UI URL
 * (`?qt=allmyphotos&photosData=…`), which makes `/shares/u!…` explode into HTTP 400 Invalid URL.
 */
export async function resolveShare(shareUrl: string): Promise<ResolvedShare> {
  const initial = shareUrl.trim();
  let encodeUrl = initial;
  let resid = extractResid(initial);

  try {
    let current = initial;
    for (let i = 0; i < 5; i += 1) {
      const host = new URL(current).hostname.toLowerCase();
      const isShort =
        host === '1drv.ms' ||
        host.endsWith('.1drv.ms') ||
        host === 'aka.ms';
      if (!isShort) {
        break;
      }

      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'ContextHub/1.0' },
      });
      const location = response.headers.get('location');
      if (
        !location ||
        !(
          response.status === 301 ||
          response.status === 302 ||
          response.status === 303 ||
          response.status === 307 ||
          response.status === 308
        )
      ) {
        break;
      }

      current = new URL(location, current).toString();
      resid = extractResid(current) ?? resid;

      if (isEncodableShareUrl(current)) {
        encodeUrl = current;
      }
      // else: keep original short link for /shares encoding
    }
  } catch {
    // keep initial
  }

  return {
    shareUrl: encodeUrl,
    ...(resid ? { resid } : {}),
  };
}

/** @deprecated use resolveShare — kept for call sites expecting a string */
export async function resolveShareUrl(shareUrl: string): Promise<string> {
  return (await resolveShare(shareUrl)).shareUrl;
}

export function encodeSharingUrl(url: string): string {
  const base64 = Buffer.from(url.trim(), 'utf8').toString('base64');
  return `u!${base64.replace(/=+$/g, '').replace(/\//g, '_').replace(/\+/g, '-')}`;
}

export function shareApiPath(
  shareUrl: string,
  resource: OneDriveGraphResource,
  itemId?: string,
): string {
  const token = encodeSharingUrl(shareUrl);
  const root: Record<OneDriveGraphResource, string> = {
    [OneDriveGraphResource.DriveItem]: `/shares/${token}/driveItem`,
    [OneDriveGraphResource.Children]: `/shares/${token}/driveItem/children`,
    [OneDriveGraphResource.Content]: `/shares/${token}/driveItem/content`,
  };
  const child: Record<OneDriveGraphResource, string> = {
    [OneDriveGraphResource.DriveItem]: `/shares/${token}/items/${itemId}`,
    [OneDriveGraphResource.Children]: `/shares/${token}/items/${itemId}/children`,
    [OneDriveGraphResource.Content]: `/shares/${token}/items/${itemId}/content`,
  };
  return (itemId ? child : root)[resource];
}

export function ownedItemApiPath(
  resid: string,
  resource: OneDriveGraphResource,
): string {
  // Graph personal ids look like `CID!sguid` — encoding `!` breaks lookups.
  const id = encodeURIComponent(resid).replace(/%21/gi, '!');
  const byResource: Record<OneDriveGraphResource, string> = {
    [OneDriveGraphResource.DriveItem]: `/me/drive/items/${id}`,
    [OneDriveGraphResource.Children]: `/me/drive/items/${id}/children`,
    [OneDriveGraphResource.Content]: `/me/drive/items/${id}/content`,
  };
  return byResource[resource];
}

export async function graphGet<T>(
  client: Client,
  path: string,
  options: {
    hasToken?: boolean;
    prefer?: string | false;
    expand?: string;
  } = {},
): Promise<T> {
  try {
    let request = client.api(path);
    if (options.expand) {
      request = request.expand(options.expand);
    }
    if (options.prefer !== false) {
      request = request.header('Prefer', options.prefer ?? PREFER_REDEEM);
    }
    return (await request.get()) as T;
  } catch (error) {
    throw toOneDriveValidationError(error, {
      ...(options.hasToken !== undefined ? { hasToken: options.hasToken } : {}),
      phase: 'share',
    });
  }
}

export async function graphGetStream(
  client: Client,
  path: string,
  options: { hasToken?: boolean; prefer?: string | false } = {},
): Promise<NodeJS.ReadableStream> {
  try {
    let request = client.api(path);
    if (options.prefer !== false) {
      request = request.header('Prefer', options.prefer ?? PREFER_REDEEM);
    }
    return (await request.getStream()) as NodeJS.ReadableStream;
  } catch (error) {
    throw toOneDriveValidationError(error, {
      ...(options.hasToken !== undefined ? { hasToken: options.hasToken } : {}),
      phase: 'share',
    });
  }
}

type ErrorContext = {
  hasToken?: boolean;
  phase?: 'identity' | 'files' | 'share';
};

export function toOneDriveValidationError(
  error: unknown,
  context: ErrorContext = {},
): VideoValidationError {
  if (error instanceof VideoValidationError) {
    return error;
  }

  if (error instanceof GraphError) {
    return new VideoValidationError(
      formatGraphError(error.statusCode, error.message || error.code || 'unknown', context),
    );
  }

  if (error instanceof Error) {
    return new VideoValidationError(
      `OneDrive Graph error: ${sanitizeDetail(error.message)}`,
    );
  }

  return new VideoValidationError('OneDrive Graph error: unknown failure');
}

function formatGraphError(
  status: number,
  detail: string,
  context: ErrorContext,
): string {
  const hasToken = Boolean(context.hasToken);
  const phase = context.phase ?? 'share';
  const clean = sanitizeDetail(detail);

  if (phase === 'identity' && (status === 401 || status === 403)) {
    return `Token inválido ou expirado (${status}). Gere um access token novo no Graph Explorer e salve de novo.`;
  }

  if (
    phase === 'files' &&
    (status === GraphHttpStatus.Forbidden ||
      status === GraphHttpStatus.Unauthorized)
  ) {
    return `Este token não tem permissão de arquivos (Files.Read). ${FILES_SCOPE_HINT}`;
  }

  if (
    status === 400 &&
    (clean.toLowerCase().includes('invalid url') || detail.includes('<HTML'))
  ) {
    return `Link OneDrive inválido para a API (400). Cole o link curto 1drv.ms (não a URL longa do navegador) ou gere um compartilhamento novo. ${NOT_FOUND_HINT}`;
  }

  if (status === GraphHttpStatus.NotFound) {
    return `Link do OneDrive não encontrado (404). O compartilhamento expirou, foi revogado ou a pasta/arquivo foi apagado. ${NOT_FOUND_HINT} Detalhe: ${clean}`;
  }

  if (
    hasToken &&
    (status === GraphHttpStatus.Unauthorized ||
      status === GraphHttpStatus.Forbidden)
  ) {
    if (clean.toLowerCase().includes('read only')) {
      return `OneDrive recusou o compartilhamento (${status}, conta em modo somente leitura na API de shares). Com token, use um arquivo/pasta que ainda exista no seu drive, ou importe pelo link de um item válido. ${NOT_FOUND_HINT}`;
    }
    return `OneDrive negou o acesso (${status}). O token provavelmente não tem Files.Read / Files.Read.All. ${FILES_SCOPE_HINT} Detalhe: ${clean}`;
  }

  if (
    status === GraphHttpStatus.Unauthorized ||
    status === GraphHttpStatus.Forbidden
  ) {
    return `OneDrive acesso negado (${status}). Deixe o link público (“qualquer pessoa com o link”) ou salve um access token com Files.Read na integração. Detalhe: ${clean}`;
  }

  return `OneDrive Graph error (${status}): ${clean}`;
}

function sanitizeDetail(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return 'unknown';
  if (trimmed.includes('<HTML') || trimmed.includes('<!DOCTYPE')) {
    if (/invalid url/i.test(trimmed)) {
      return 'Bad Request - Invalid URL';
    }
    return 'Resposta HTML inesperada do Graph';
  }
  return trimmed.slice(0, 280);
}

function isEncodableShareUrl(url: string): boolean {
  if (url.length > MAX_SHARE_URL_CHARS) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const query = parsed.search.toLowerCase();

  // Photos / gallery UI redirects blow up share encoding.
  if (query.includes('photosdata=') || query.includes('qt=allmyphotos')) {
    return false;
  }

  if (host.includes('sharepoint.com') || host.includes('sharepoint-df.com')) {
    return true;
  }
  if (host === '1drv.ms' || host.endsWith('.1drv.ms')) {
    return true;
  }
  if (host.includes('onedrive.live.com') || host.includes('onedrive.com')) {
    return (
      path.includes('/redir') ||
      path.includes('/:') ||
      path.includes('/share') ||
      Boolean(parsed.searchParams.get('resid')) ||
      Boolean(parsed.searchParams.get('cid') && parsed.searchParams.get('id'))
    );
  }
  return false;
}

/** Pull drive item id from share / redirect URLs. */
export function extractResid(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    const fromResid = parsed.searchParams.get('resid')?.trim();
    if (fromResid) {
      return fromResid;
    }
    const fromId = parsed.searchParams.get('id')?.trim();
    if (fromId && fromId.includes('!')) {
      return fromId;
    }

    // photosData=/share/CID!item?...
    const photosData = parsed.searchParams.get('photosData');
    if (photosData) {
      const decoded = decodeURIComponent(photosData);
      const match = decoded.match(
        /\/share\/([A-Fa-f0-9]+![A-Za-z0-9_-]+)/,
      );
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
