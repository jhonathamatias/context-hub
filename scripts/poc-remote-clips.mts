/**
 * POC 3 Phase 1 — Range clip extraction with transfer measurement. NO Gemini.
 *
 *   docker compose exec -T node pnpm poc:remote-clips <sourceId>
 *
 * Optional:
 *   POC_ONEDRIVE_INTEGRATION_ID
 *   POC_ONEDRIVE_ITEM_ID
 */
import 'reflect-metadata';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Container } from 'typedi';
import { OneDriveVideoConnector } from '../src/connectors/onedrive.connector';
import { env } from '../src/config/env';
import { DatabaseService } from '../src/database/database.service';
import { Source } from '../src/database/entities/source.entity';
import { IntegrationService } from '../src/integrations/integration.service';
import { aggregateRemoteAccess } from '../src/poc/remote-multimodal/metrics';
import { extractTop3Clips } from '../src/poc/remote-multimodal/remote-clip-extractor';
import { formatPhase1Report } from '../src/poc/remote-multimodal/report';
import { selectTop3 } from '../src/poc/remote-multimodal/top3';

async function main(): Promise<void> {
  const sourceId = process.argv[2]?.trim();
  if (!sourceId) {
    console.error('Usage: pnpm poc:remote-clips <sourceId>');
    process.exit(2);
  }

  const database = Container.get(DatabaseService);
  await database.connect();

  try {
    const source = await database.getRepository(Source).findOne({
      where: { id: sourceId },
    });
    if (!source) throw new Error(`Source not found: ${sourceId}`);

    const localPath = join(env.storageDir, source.storageKey);
    const localStat = await stat(localPath);
    let originalVideoBytes = localStat.size;

    const workDir = join(
      env.tempDir,
      'poc-remote-clips',
      sourceId,
      String(Date.now()),
    );
    await mkdir(workDir, { recursive: true });

    const windows = selectTop3();
    const notes: string[] = [];
    let onedriveError: string | null = null;
    let remoteUrl: string | null = null;
    let remoteSize: number | null = null;

    try {
      const resolved = await tryResolveOneDrivePlayback();
      if (resolved) {
        remoteUrl = resolved.downloadUrl;
        remoteSize = resolved.size;
        notes.push(
          `OneDrive playback URL resolved (item=${resolved.itemId}, size=${resolved.size})`,
        );
      } else {
        onedriveError =
          'No POC_ONEDRIVE_INTEGRATION_ID or could not list/resolve item.';
        notes.push(onedriveError);
      }
    } catch (error) {
      onedriveError = error instanceof Error ? error.message : String(error);
      notes.push(`OneDrive resolve failed: ${onedriveError}`);
    }

    let extractResult:
      | Awaited<ReturnType<typeof extractTop3Clips>>
      | undefined;
    let fullDownloadAvoided: 'YES' | 'NO' | 'UNPROVEN' = 'UNPROVEN';
    let remoteSeekResult: 'OK' | 'FAILED' | 'SIMULATED' = 'FAILED';

    if (remoteUrl) {
      try {
        extractResult = await extractTop3Clips({
          windows,
          workDir,
          source: { kind: 'remote', url: remoteUrl },
        });
        remoteSeekResult = 'OK';
        const transferred = extractResult.clips.reduce(
          (s, c) => s + (c.transferredBytes ?? 0),
          0,
        );
        const baseline = remoteSize ?? originalVideoBytes;
        fullDownloadAvoided =
          transferred > 0 && transferred < baseline * 0.5 ? 'YES' : 'NO';
        notes.push(
          'Extraction used remote OneDrive/CDN URL via byte-counting proxy.',
        );
        originalVideoBytes = remoteSize ?? originalVideoBytes;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onedriveError = [onedriveError, msg].filter(Boolean).join(' | ');
        notes.push(
          `REMOTE SEEK RESULT: FAILED (${msg}). Using labeled local Range simulation fallback for measurement/multimodal prep — NOT silent.`,
        );
        remoteSeekResult = 'FAILED';
        fullDownloadAvoided = 'UNPROVEN';
      }
    }

    if (!extractResult) {
      extractResult = await extractTop3Clips({
        windows,
        workDir,
        source: { kind: 'local-file', path: localPath },
      });
      if (remoteSeekResult !== 'OK') {
        remoteSeekResult = remoteUrl ? 'FAILED' : 'SIMULATED';
        fullDownloadAvoided = 'UNPROVEN';
        notes.push(
          'SIMULATED: local original.mp4 over HTTP Range + FFmpeg; transferredBytes counted at proxy.',
        );
        notes.push(
          'This does NOT prove OneDrive CDN seek. Full download avoided (OneDrive): UNPROVEN.',
        );
      }
    }

    const summary = aggregateRemoteAccess({
      originalVideoBytes,
      clips: extractResult.clips,
      fullDownloadAvoided,
      remoteSeekResult,
      notes,
    });

    console.log(
      formatPhase1Report({
        sourceId,
        summary,
        clips: extractResult.clips,
        rangeProbe: extractResult.rangeProbe,
        onedriveError,
      }),
    );

    const artifactPath = join(workDir, 'phase1.json');
    await writeFile(
      artifactPath,
      JSON.stringify(
        {
          sourceId,
          workDir,
          summary,
          clips: extractResult.clips,
          rangeProbe: extractResult.rangeProbe,
          onedriveError,
          windows,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(`\nArtifact: ${artifactPath}`);
  } finally {
    await database.disconnect();
  }
}

async function tryResolveOneDrivePlayback(): Promise<{
  downloadUrl: string;
  itemId: string;
  size: number | null;
} | null> {
  const integrationId = process.env.POC_ONEDRIVE_INTEGRATION_ID?.trim();
  if (!integrationId) return null;

  const integrations = Container.get(IntegrationService);
  const connector = Container.get(OneDriveVideoConnector);

  const shareUrl = await integrations.resolveOneDriveShareUrl(integrationId);
  const accessToken =
    await integrations.resolveOneDriveAccessToken(integrationId);

  let itemId = process.env.POC_ONEDRIVE_ITEM_ID?.trim();
  if (!itemId) {
    const items = await connector.listVideos(shareUrl, {
      ...(accessToken ? { accessToken } : {}),
    });
    const match =
      items.find((i) => i.name.toLowerCase().includes('talisson')) ?? items[0];
    itemId = match?.id;
  }
  if (!itemId) return null;

  const playback = await connector.resolvePlayback({
    shareUrl,
    itemId,
    ...(accessToken ? { accessToken } : {}),
  });

  return {
    downloadUrl: playback.downloadUrl,
    itemId: playback.itemId,
    size: playback.size,
  };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
