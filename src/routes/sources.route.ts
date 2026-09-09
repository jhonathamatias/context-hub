import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { TranscriptionService } from '../transcription';
import { SourceIngestService } from '../video';

export async function sourcesRoute(app: FastifyInstance) {
  const ingestService = Container.get(SourceIngestService);
  const transcriptionService = Container.get(TranscriptionService);

  app.post('/sources/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing multipart file field "file" or "video"',
        requestId: request.id,
      });
    }

    try {
      const result = await ingestService.ingest({
        filename: data.filename,
        mimetype: data.mimetype,
        fileStream: data.file,
        logger: request.log,
      });

      return reply.status(201).send(result);
    } catch (error) {
      // Drain remaining stream on failure to avoid hanging sockets.
      data.file.resume();
      throw error;
    }
  });

  app.post('/sources/:sourceId/transcribe', async (request, reply) => {
    const { sourceId } = request.params as { sourceId: string };

    const result = await transcriptionService.transcribeSource(
      sourceId,
      request.log,
    );

    return reply.status(201).send(result);
  });
}
