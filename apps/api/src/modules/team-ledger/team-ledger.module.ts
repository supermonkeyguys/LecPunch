import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamLedgerEntry, TeamLedgerEntrySchema } from './schemas/team-ledger-entry.schema';
import { TeamLedgerService } from './team-ledger.service';
import { TeamLedgerController } from './team-ledger.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: TeamLedgerEntry.name, schema: TeamLedgerEntrySchema }])],
  controllers: [TeamLedgerController],
  providers: [TeamLedgerService],
  exports: [TeamLedgerService]
})
export class TeamLedgerModule {}
