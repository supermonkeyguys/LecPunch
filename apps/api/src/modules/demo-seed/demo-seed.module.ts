import { Module } from '@nestjs/common';
import { DemoSeedService } from './demo-seed.service';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [UsersModule, TeamsModule],
  providers: [DemoSeedService],
  exports: [DemoSeedService]
})
export class DemoSeedModule {}
