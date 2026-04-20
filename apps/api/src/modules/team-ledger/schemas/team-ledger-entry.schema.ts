import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TeamLedgerType } from '@lecpunch/shared';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'team_ledger_entries' })
export class TeamLedgerEntry {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: Date })
  occurredAt!: Date;

  @Prop({ required: true, type: String, enum: ['income', 'expense'] })
  type!: TeamLedgerType;

  @Prop({ required: true, type: Number, min: 1 })
  amountCents!: number;

  @Prop({ required: true, type: String })
  category!: string;

  @Prop({ type: String })
  counterparty?: string;

  @Prop({ type: String })
  note?: string;

  @Prop({ required: true, type: String })
  createdBy!: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type TeamLedgerEntryDocument = HydratedDocument<TeamLedgerEntry>;
export const TeamLedgerEntrySchema = SchemaFactory.createForClass(TeamLedgerEntry);

TeamLedgerEntrySchema.index({ teamId: 1, occurredAt: -1 });
TeamLedgerEntrySchema.index({ teamId: 1, type: 1, occurredAt: -1 });
TeamLedgerEntrySchema.index({ teamId: 1, category: 1, occurredAt: -1 });
