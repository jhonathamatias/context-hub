import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { KnowledgeExtraction } from './entities/knowledge-extraction.entity';
import { ProcessingJob } from './entities/processing-job.entity';
import { Source } from './entities/source.entity';
import { TranscriptChunk } from './entities/transcript-chunk.entity';
import { Transcription } from './entities/transcription.entity';
import { AddTranscriptions1788912000000 } from './migrations/1788912000000-AddTranscriptions';
import { InitSourceAndProcessingJob1788825600000 } from './migrations/1788825600000-InitSourceAndProcessingJob';
import { RenameColumnsToSnakeCase1788915000000 } from './migrations/1788915000000-RenameColumnsToSnakeCase';
import { AddKnowledgeTables1788918000000 } from './migrations/1788918000000-AddKnowledgeTables';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.databaseUrl,
  entities: [
    Source,
    ProcessingJob,
    Transcription,
    TranscriptChunk,
    KnowledgeExtraction,
  ],
  migrations: [
    InitSourceAndProcessingJob1788825600000,
    AddTranscriptions1788912000000,
    RenameColumnsToSnakeCase1788915000000,
    AddKnowledgeTables1788918000000,
  ],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: env.nodeEnv === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);
