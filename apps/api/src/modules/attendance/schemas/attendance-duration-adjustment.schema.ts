import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttendanceDurationAdjustmentOperation = 'add' | 'subtract';

@Schema({ timestamps: true, collection: 'attendance_duration_adjustments' })
export class AttendanceDurationAdjustment {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String })
  username!: string;

  @Prop({ required: true, type: String, index: true })
  weekKey!: string;

  @Prop({ required: true, type: String, enum: ['add', 'subtract'] })
  operation!: AttendanceDurationAdjustmentOperation;

  @Prop({ required: true, type: Number, min: 1 })
  durationSeconds!: number;

  @Prop({ required: true, type: Number })
  signedDurationSeconds!: number;

  @Prop({ required: true, type: Number, min: 0 })
  previousDurationSeconds!: number;

  @Prop({ required: true, type: Number, min: 0 })
  resultingDurationSeconds!: number;

  @Prop({ required: true, type: String })
  createdBy!: string;

  @Prop({ type: String })
  reason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceDurationAdjustmentDocument = HydratedDocument<AttendanceDurationAdjustment>;
export const AttendanceDurationAdjustmentSchema = SchemaFactory.createForClass(AttendanceDurationAdjustment);

AttendanceDurationAdjustmentSchema.index({ teamId: 1, userId: 1, weekKey: 1, createdAt: -1 });
