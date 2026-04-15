import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config/env.validation';
import { DatabaseModule } from './modules/database/database.module';
import { UsersModule } from './modules/users/users.module';
import { TeamsModule } from './modules/teams/teams.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { RecordsModule } from './modules/records/records.module';
import { StatsModule } from './modules/stats/stats.module';
import { DemoSeedModule } from './modules/demo-seed/demo-seed.module';
import { NetworkPolicyModule } from './modules/network-policy/network-policy.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema
    }),
    DatabaseModule,
    UsersModule,
    TeamsModule,
    AuthModule,
    NetworkPolicyModule,
    AttendanceModule,
    RecordsModule,
    StatsModule,
    NotificationsModule,
    DemoSeedModule
  ]
})
export class AppModule {}
