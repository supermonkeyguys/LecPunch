import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AttendanceInvalidReason, AttendancePauseReason, AttendanceStatus } from '@lecpunch/shared';

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

  @Prop({ type: Date })
  lastKeepaliveAt?: Date;

  @Prop({ type: Date })
  lastCreditedAt?: Date;

  @Prop({ type: Number, default: 0 })
  creditedSeconds!: number;

  @Prop({ type: Date })
  pausedAt?: Date;

  @Prop({ type: String, enum: ['heartbeat_timeout', 'network_not_allowed', 'client_offline'], required: false })
  pauseReason?: AttendancePauseReason;

  @Prop({ type: Number, default: 0 })
  segmentsCount!: number;

  @Prop({ type: Number })
  durationSeconds?: number;

  @Prop({ type: String, enum: ['active', 'completed', 'invalidated'], default: 'active' })
  status!: AttendanceStatus;

  @Prop({ type: String, enum: ['overtime_5h', 'heartbeat_timeout'], required: false })
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
