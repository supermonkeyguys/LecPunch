import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GitHubSourcesModule } from '../github-sources/github-sources.module';
import { UsersModule } from '../users/users.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportReference, WeeklyReportReferenceSchema } from './schemas/weekly-report-reference.schema';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WeeklyReportReference.name, schema: WeeklyReportReferenceSchema }]),
    GitHubSourcesModule,
    UsersModule,
    AttendanceModule
  ],
  providers: [WeeklyReportsService],
  controllers: [WeeklyReportsController]
})
export class WeeklyReportsModule {}
