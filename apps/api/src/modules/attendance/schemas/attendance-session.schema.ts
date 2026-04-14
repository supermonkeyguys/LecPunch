import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AttendanceInvalidReason, AttendanceStatus } from '@lecpunch/shared';

@Schema({ timestamps: true, collection: 'attendance_sessions' })
export class AttendanceSession {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: Date })
  checkInAt!: Date;

  @Prop({ type: Date })
  checkOutAt?: Date;

  @Prop({ type: Number })
  durationSeconds?: number;

  @Prop({ type: String, enum: ['active', 'completed', 'invalidated'], default: 'active' })
  status!: AttendanceStatus;

  @Prop({ type: String, enum: ['overtime_5h'], required: false })
  invalidReason?: AttendanceInvalidReason;

  @Prop({ required: true, type: String })
  sourceIpAtCheckIn!: string;

  @Prop({ type: String })
  sourceIpAtCheckOut?: string;

  @Prop({ required: true, type: String, index: true })
  weekKey!: string;

  @Prop({ type: Number })
  weeklyGoalSecondsSnapshot?: number;

  @Prop({ type: Boolean, default: false })
  isMarked!: boolean;
}

export type AttendanceSessionDocument = HydratedDocument<AttendanceSession>;
export const AttendanceSessionSchema = SchemaFactory.createForClass(AttendanceSession);

AttendanceSessionSchema.index({ userId: 1, status: 1 });
AttendanceSessionSchema.index({ teamId: 1, weekKey: 1, userId: 1 });
AttendanceSessionSchema.index({ userId: 1, checkInAt: -1 });
AttendanceSessionSchema.index({ teamId: 1, checkInAt: -1 });
