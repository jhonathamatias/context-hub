import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { ProcessingJob } from './entities/processing-job.entity';
import { Source } from './entities/source.entity';
import { InitSourceAndProcessingJob1788825600000 } from './migrations/1788825600000-InitSourceAndProcessingJob';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: env.databaseUrl,
  entities: [Source, ProcessingJob],
  migrations: [InitSourceAndProcessingJob1788825600000],
  synchronize: false,
  logging: env.nodeEnv === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);
