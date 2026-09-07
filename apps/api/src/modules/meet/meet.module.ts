import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MeetController } from './meet.controller';
import { MeetService } from './meet.service';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [MeetController],
  providers: [MeetService]
})
export class MeetModule {}
