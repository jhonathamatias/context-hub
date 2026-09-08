import 'reflect-metadata';
import { Container } from 'typedi';
import { DatabaseService } from './database.service';

async function main() {
  const database = Container.get(DatabaseService);

  try {
    await database.connect();
    const ok = await database.ping();
    console.log(JSON.stringify({ database: ok ? 'up' : 'down' }));
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

void main();
