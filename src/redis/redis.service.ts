import Redis from 'ioredis';
import { Service } from 'typedi';
import { env } from '../config/env';

@Service()
export class RedisService {
  private client: Redis | null = null;

  get isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async connect(): Promise<void> {
    if (this.client?.status === 'ready') {
      return;
    }

    const client = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });

    client.on('error', (error) => {
      // Avoid crashing the process; callers decide how to handle failures.
      console.error('[redis] connection error:', error.message);
    });

    try {
      await client.connect();
      this.client = client;
    } catch (error) {
      client.disconnect();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to Redis: ${message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;
    await client.quit();
  }

  getClient(): Redis {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Redis is not connected');
    }

    return this.client;
  }

  async ping(): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') {
      return false;
    }

    const result = await this.client.ping();
    return result === 'PONG';
  }
}
