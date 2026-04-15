import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AttendanceModule, UsersModule, NotificationsModule],
  providers: [RecordsService],
  controllers: [RecordsController]
})
export class RecordsModule {}
