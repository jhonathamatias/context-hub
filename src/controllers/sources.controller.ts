import type { FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import { Service } from 'typedi';
import {
  getBody,
  getParams,
  getQuery,
  type IngestFilesystemBody,
  type IngestOneDriveBody,
  type ListSourcesQuery,
  type PreviewOneDriveBody,
  type SourceIdParams,
} from '../http';
import { JobQueueService } from '../jobs';
import { IntegrationService } from '../integrations';
import {
  SourceQueryService,
  toPublicAcceptResult,
  toPublicQueuedResult,
} from '../sources';
import { SourceIngestService } from '../video';

@Service()
export class SourcesController {
  constructor(
    private readonly ingestService: SourceIngestService,
    private readonly sourceQuery: SourceQueryService,
    private readonly jobs: JobQueueService,
    private readonly integrations: IntegrationService,
  ) {}

  async upload(request: FastifyRequest, reply: FastifyReply) {
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
      const accepted = await this.ingestService.acceptUpload({
        filename: data.filename,
        mimetype: data.mimetype,
        fileStream: data.file,
        logger: request.log,
      });

      await this.jobs.enqueueVideoExtract(accepted.sourceId);

      return reply.status(202).send(toPublicAcceptResult(accepted));
    } catch (error) {
      data.file.resume();
      throw error;
    }
  }

  async fromFilesystem(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<IngestFilesystemBody>(request);
    const accepted = await this.ingestService.acceptFromFilesystem(
      { path: body.path },
      request.log,
    );

    await this.jobs.enqueueVideoExtract(accepted.sourceId);

    return reply.status(202).send(toPublicAcceptResult(accepted));
  }

  async previewOneDrive(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<PreviewOneDriveBody>(request);
    const shareUrl = await this.integrations.resolveOneDriveShareUrl(
      body.integrationId,
      body.url,
    );
    const accessToken = await this.integrations.resolveOneDriveAccessToken(
      body.integrationId,
    );
    const videos = await this.ingestService.previewOneDrive(
      {
        shareUrl,
        ...(accessToken ? { accessToken } : {}),
      },
      request.log,
    );
    return reply.status(200).send({ items: videos });
  }

  async fromOneDrive(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<IngestOneDriveBody>(request);
    const shareUrl = await this.integrations.resolveOneDriveShareUrl(
      body.integrationId,
      body.url,
    );
    const accessToken = await this.integrations.resolveOneDriveAccessToken(
      body.integrationId,
    );
    const input = {
      shareUrl,
      ...(accessToken ? { accessToken } : {}),
      ...(body.itemId ? { itemId: body.itemId } : {}),
      ...(body.importAll !== undefined ? { importAll: body.importAll } : {}),
    };
    const accepted = await this.ingestService.acceptFromOneDrive(
      input,
      request.log,
    );

    for (const item of accepted) {
      await this.jobs.enqueueVideoExtract(item.sourceId);
    }

    return reply.status(202).send({
      items: accepted.map(toPublicAcceptResult),
      count: accepted.length,
    });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = getQuery<ListSourcesQuery>(request);
    const result = await this.sourceQuery.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {}),
    });
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.sourceQuery.getById(sourceId);
    return reply.status(200).send(result);
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.sourceQuery.getStatus(sourceId);
    return reply.status(200).send(result);
  }

  async streamMedia(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const media = await this.sourceQuery.resolveMedia(sourceId);
    const size = media.size;
    const rangeHeader = request.headers.range;

    reply.header('Accept-Ranges', 'bytes');
    reply.header(
      'Content-Disposition',
      `inline; filename="${media.originalName.replace(/"/g, '')}"`,
    );
    reply.type(media.mimeType);

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        return reply
          .status(416)
          .header('Content-Range', `bytes */${size}`)
          .send();
      }

      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : size - 1;
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        start >= size
      ) {
        return reply
          .status(416)
          .header('Content-Range', `bytes */${size}`)
          .send();
      }
      end = Math.min(end, size - 1);
      const chunkSize = end - start + 1;

      reply.status(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
      reply.header('Content-Length', chunkSize);
      return reply.send(createReadStream(media.absolutePath, { start, end }));
    }

    reply.header('Content-Length', size);
    return reply.send(createReadStream(media.absolutePath));
  }

  async getTranscript(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.sourceQuery.getTranscript(sourceId);
    return reply.status(200).send(result);
  }

  async getKnowledge(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.sourceQuery.getKnowledge(sourceId);
    return reply.status(200).send(result);
  }

  async transcribe(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    await this.sourceQuery.getById(sourceId);
    const queued = await this.jobs.enqueueTranscription(sourceId);
    return reply.status(202).send(toPublicQueuedResult(queued));
  }

  async enqueueKnowledge(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    await this.sourceQuery.getById(sourceId);
    const queued = await this.jobs.enqueueKnowledge(sourceId);
    return reply.status(202).send(toPublicQueuedResult(queued));
  }

  async embeddings(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    await this.sourceQuery.getById(sourceId);
    const queued = await this.jobs.enqueueEmbeddings(sourceId);
    return reply.status(202).send(toPublicQueuedResult(queued));
  }
}
