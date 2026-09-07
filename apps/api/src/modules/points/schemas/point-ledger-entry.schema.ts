import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'point_ledger_entries' })
export class PointLedgerEntry {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String, index: true })
  weekKey!: string;

  @Prop({ required: true, type: String, enum: ['attendance', 'skin_unlock'], default: 'attendance' })
  sourceType!: 'attendance' | 'skin_unlock';

  // Kept under its original persisted field name for backward compatibility.
  // Non-attendance entries store their immutable source reference here too.
  @Prop({ required: true, type: String, unique: true })
  sourceAttendanceSessionId!: string;

  // Attendance earns positive points; auditable shop purchases spend negative points.
  @Prop({ required: true, type: Number, default: 0 })
  points!: number;
}

export type PointLedgerEntryDocument = HydratedDocument<PointLedgerEntry>;
export const PointLedgerEntrySchema = SchemaFactory.createForClass(PointLedgerEntry);

PointLedgerEntrySchema.index({ userId: 1, teamId: 1, weekKey: 1 });
