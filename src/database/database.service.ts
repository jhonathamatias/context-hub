import type { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { Service } from 'typedi';
import { AppDataSource } from './data-source';

@Service()
export class DatabaseService {
  async connect(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  }

  async disconnect(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }

  get isConnected(): boolean {
    return AppDataSource.isInitialized;
  }

  getRepository<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
  ): Repository<Entity> {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database is not connected');
    }

    return AppDataSource.getRepository(entity);
  }

  async ping(): Promise<boolean> {
    if (!AppDataSource.isInitialized) {
      return false;
    }

    await AppDataSource.query('SELECT 1');
    return true;
  }
}
