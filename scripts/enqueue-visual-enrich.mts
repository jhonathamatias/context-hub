/**
 * Manually enqueue hybrid visual.enrich (+ embeddings after, via dispatcher).
 *   docker compose exec -T node pnpm tsx scripts/enqueue-visual-enrich.mts <sourceId>
 */
import 'reflect-metadata';
import { Container } from 'typedi';
import { registerDomainProviders } from '../src/di';
import { JobQueueService } from '../src/jobs/queue.service';

async function main(): Promise<void> {
  const sourceId = process.argv[2]?.trim();
  if (!sourceId) {
    console.error('Usage: pnpm tsx scripts/enqueue-visual-enrich.mts <sourceId>');
    process.exit(2);
  }
  registerDomainProviders();
  const queue = Container.get(JobQueueService);
  const result = await queue.enqueueVisualEnrich(sourceId);
  console.log(JSON.stringify(result, null, 2));
  await queue.close();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
