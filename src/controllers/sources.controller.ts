import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import { EmbeddingService } from '../embeddings';
import {
  getBody,
  getParams,
  getQuery,
  type IngestFilesystemBody,
  type ListSourcesQuery,
  type SourceIdParams,
} from '../http';
import { KnowledgeService } from '../knowledge';
import {
  SourceQueryService,
  toPublicIngestResult,
  toPublicTranscribeResult,
} from '../sources';
import { TranscriptionService } from '../transcription';
import { SourceIngestService } from '../video';

@Service()
export class SourcesController {
  constructor(
    private readonly ingestService: SourceIngestService,
    private readonly transcriptionService: TranscriptionService,
    private readonly knowledgeService: KnowledgeService,
    private readonly embeddingService: EmbeddingService,
    private readonly sourceQuery: SourceQueryService,
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
      const result = await this.ingestService.ingest({
        filename: data.filename,
        mimetype: data.mimetype,
        fileStream: data.file,
        logger: request.log,
      });

      return reply.status(201).send(toPublicIngestResult(result));
    } catch (error) {
      data.file.resume();
      throw error;
    }
  }

  async fromFilesystem(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<IngestFilesystemBody>(request);
    const result = await this.ingestService.ingestFromFilesystem(
      { path: body.path },
      request.log,
    );

    return reply.status(201).send(toPublicIngestResult(result));
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

  async getTranscript(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.sourceQuery.getTranscript(sourceId);
    return reply.status(200).send(result);
  }

  async transcribe(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.transcriptionService.transcribeSource(
      sourceId,
      request.log,
    );

    return reply.status(201).send(toPublicTranscribeResult(result));
  }

  async knowledge(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.knowledgeService.processSource(
      sourceId,
      request.log,
    );

    const statusCode = result.knowledgeStatus === 'FAILED' ? 207 : 201;
    return reply.status(statusCode).send(result);
  }

  async embeddings(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = getParams<SourceIdParams>(request);
    const result = await this.embeddingService.processSource(
      sourceId,
      request.log,
    );

    return reply.status(201).send(result);
  }
}
