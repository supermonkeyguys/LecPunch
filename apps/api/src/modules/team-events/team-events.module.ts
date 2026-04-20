import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamEvent, TeamEventSchema } from './schemas/team-event.schema';
import { TeamEventsService } from './team-events.service';
import { TeamEventsController } from './team-events.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: TeamEvent.name, schema: TeamEventSchema }])],
  controllers: [TeamEventsController],
  providers: [TeamEventsService],
  exports: [TeamEventsService]
})
export class TeamEventsModule {}
