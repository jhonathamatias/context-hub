import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { ProcessingJob } from './entities/processing-job.entity';
import { Source } from './entities/source.entity';
import { Transcription } from './entities/transcription.entity';
import { AddTranscriptions1788912000000 } from './migrations/1788912000000-AddTranscriptions';
import { InitSourceAndProcessingJob1788825600000 } from './migrations/1788825600000-InitSourceAndProcessingJob';
import { RenameColumnsToSnakeCase1788915000000 } from './migrations/1788915000000-RenameColumnsToSnakeCase';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.databaseUrl,
  entities: [Source, ProcessingJob, Transcription],
  migrations: [
    InitSourceAndProcessingJob1788825600000,
    AddTranscriptions1788912000000,
    RenameColumnsToSnakeCase1788915000000,
  ],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: env.nodeEnv === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);
