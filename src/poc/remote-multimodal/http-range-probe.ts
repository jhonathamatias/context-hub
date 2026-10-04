export type HttpRangeProbeResult = {
  urlHost: string;
  headStatus: number | null;
  acceptRanges: string | null;
  contentLength: number | null;
  rangeGetStatus: number | null;
  rangeContentLength: number | null;
  contentRange: string | null;
  supportsPartialContent: boolean;
  redirectCount: number;
  finalUrlHost: string | null;
  notes: string[];
};

/**
 * Probe HTTP Range behavior for a temporary download/playback URL.
 * Does not download the full body.
 */
export async function probeHttpRange(
  url: string,
): Promise<HttpRangeProbeResult> {
  const notes: string[] = [];
  let redirectCount = 0;
  let finalUrlHost: string | null = null;

  let headStatus: number | null = null;
  let acceptRanges: string | null = null;
  let contentLength: number | null = null;

  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });
    headStatus = head.status;
    acceptRanges = head.headers.get('accept-ranges');
    const cl = head.headers.get('content-length');
    contentLength = cl ? Number(cl) : null;
    finalUrlHost = safeHost(head.url);
    // fetch doesn't expose redirect count; note if URL changed
    if (safeHost(url) !== finalUrlHost) {
      redirectCount = 1;
      notes.push('HEAD followed redirect(s) to a different host');
    }
  } catch (error) {
    notes.push(
      `HEAD failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let rangeGetStatus: number | null = null;
  let rangeContentLength: number | null = null;
  let contentRange: string | null = null;

  try {
    const ranged = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      redirect: 'follow',
    });
    rangeGetStatus = ranged.status;
    contentRange = ranged.headers.get('content-range');
    const cl = ranged.headers.get('content-length');
    rangeContentLength = cl ? Number(cl) : null;
    // Drain at most 1 KiB then cancel
    const reader = ranged.body?.getReader();
    if (reader) {
      await reader.read();
      await reader.cancel();
    }
    finalUrlHost = safeHost(ranged.url) ?? finalUrlHost;
  } catch (error) {
    notes.push(
      `Range GET failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const supportsPartialContent =
    rangeGetStatus === 206 ||
    (acceptRanges?.toLowerCase().includes('bytes') ?? false);

  return {
    urlHost: safeHost(url) ?? 'unknown',
    headStatus,
    acceptRanges,
    contentLength,
    rangeGetStatus,
    rangeContentLength,
    contentRange,
    supportsPartialContent,
    redirectCount,
    finalUrlHost,
    notes,
  };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
