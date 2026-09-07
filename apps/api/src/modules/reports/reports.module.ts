import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './reports.controller';
import { Report, ReportSchema } from './schemas/report.schema';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    NotificationsModule,
    UsersModule
  ],
  providers: [ReportsService],
  controllers: [ReportsController]
})
export class ReportsModule {}
