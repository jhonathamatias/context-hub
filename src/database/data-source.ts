import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { ProcessingJob } from './entities/processing-job.entity';
import { Source } from './entities/source.entity';
import { InitSourceAndProcessingJob1788825600000 } from './migrations/1788825600000-InitSourceAndProcessingJob';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const name = process.env.DB_NAME ?? 'context-hub';

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: buildDatabaseUrl(),
  entities: [Source, ProcessingJob],
  migrations: [InitSourceAndProcessingJob1788825600000],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export const AppDataSource = new DataSource(dataSourceOptions);
