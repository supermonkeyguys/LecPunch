import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AttendanceModule, UsersModule],
  providers: [StatsService],
  controllers: [StatsController]
})
export class StatsModule {}
