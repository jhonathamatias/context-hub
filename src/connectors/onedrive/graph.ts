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

const PREFER_REDEEM = 'redeemSharingLink';

const ERROR_MESSAGE_BY_STATUS: Partial<
  Record<number, (detail: string) => string>
> = {
  [GraphHttpStatus.Unauthorized]: (detail) =>
    `OneDrive access denied (${GraphHttpStatus.Unauthorized}). Share must allow "anyone with the link" or set ONEDRIVE_ACCESS_TOKEN. ${detail}`,
  [GraphHttpStatus.Forbidden]: (detail) =>
    `OneDrive access denied (${GraphHttpStatus.Forbidden}). Share must allow "anyone with the link" or set ONEDRIVE_ACCESS_TOKEN. ${detail}`,
};

/**
 * Graph client for OneDrive shares.
 * With a token: default auth middleware.
 * Without: retry/redirect/telemetry only — public redeemSharingLink shares work anonymously.
 */
export function createOneDriveGraphClient(accessToken?: string): Client {
  if (accessToken) {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
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

export async function graphGet<T>(
  client: Client,
  path: string,
): Promise<T> {
  try {
    return (await client.api(path).header('Prefer', PREFER_REDEEM).get()) as T;
  } catch (error) {
    throw toOneDriveValidationError(error);
  }
}

export async function graphGetStream(
  client: Client,
  path: string,
): Promise<NodeJS.ReadableStream> {
  try {
    return (await client
      .api(path)
      .header('Prefer', PREFER_REDEEM)
      .getStream()) as NodeJS.ReadableStream;
  } catch (error) {
    throw toOneDriveValidationError(error);
  }
}

export function toOneDriveValidationError(error: unknown): VideoValidationError {
  if (error instanceof VideoValidationError) {
    return error;
  }

  if (error instanceof GraphError) {
    const detail = error.message || error.code || 'unknown';
    const format =
      ERROR_MESSAGE_BY_STATUS[error.statusCode] ??
      ((message: string) =>
        `OneDrive Graph error (${error.statusCode}): ${message}`);
    return new VideoValidationError(format(detail));
  }

  if (error instanceof Error) {
    return new VideoValidationError(`OneDrive Graph error: ${error.message}`);
  }

  return new VideoValidationError('OneDrive Graph error: unknown failure');
}
