import { Container, Service } from 'typedi';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

type DependencyStatus = 'up' | 'down';

@Service()
export class HealthService {
  private readonly database: DatabaseService;
  private readonly redis: RedisService;

  constructor() {
    // Explicit resolve keeps DI working under tsx (no emitDecoratorMetadata).
    this.database = Container.get(DatabaseService);
    this.redis = Container.get(RedisService);
  }

  async check(): Promise<{
    status: 'ok' | 'degraded';
    database: DependencyStatus;
    redis: DependencyStatus;
    statusCode: 200 | 503;
  }> {
    const [database, redis] = await Promise.all([
      this.pingDependency(() => this.database.ping()),
      this.pingDependency(() => this.redis.ping()),
    ]);

    const isUp = database === 'up' && redis === 'up';

    return {
      status: isUp ? 'ok' : 'degraded',
      database,
      redis,
      statusCode: isUp ? 200 : 503,
    };
  }

  private async pingDependency(
    ping: () => Promise<boolean>,
  ): Promise<DependencyStatus> {
    try {
      return (await ping()) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
