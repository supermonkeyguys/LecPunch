import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DemoSeedService } from '../modules/demo-seed/demo-seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const demoSeedService = app.get(DemoSeedService);
    const result = await demoSeedService.seed();
    console.log(`Seeded demo data for ${result.teamName}: ${result.createdUsers.join(', ') || 'no new users created'}`);
  } finally {
    await app.close();
  }
}

void main();
