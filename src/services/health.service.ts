import { Container, Service } from 'typedi';
import { DatabaseService } from '../database/database.service';

@Service()
export class HealthService {
  private readonly database: DatabaseService;

  constructor() {
    // Explicit resolve keeps DI working under tsx (no emitDecoratorMetadata).
    this.database = Container.get(DatabaseService);
  }

  async check(): Promise<{
    status: 'ok' | 'degraded';
    database: 'up' | 'down';
    statusCode: 200 | 503;
  }> {
    let databaseStatus: 'up' | 'down' = 'down';

    try {
      databaseStatus = (await this.database.ping()) ? 'up' : 'down';
    } catch {
      databaseStatus = 'down';
    }

    const isUp = databaseStatus === 'up';

    return {
      status: isUp ? 'ok' : 'degraded',
      database: databaseStatus,
      statusCode: isUp ? 200 : 503,
    };
  }
}
