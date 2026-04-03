import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceSession, AttendanceSessionSchema } from './schemas/attendance-session.schema';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';

@Module({
  imports: [
    NetworkPolicyModule,
    MongooseModule.forFeature([{ name: AttendanceSession.name, schema: AttendanceSessionSchema }])
  ],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService]
})
export class AttendanceModule {
  constructor() {
    console.log('🔥 AttendanceModule loaded!'); // 重启后看控制台是否输出
  }
}
