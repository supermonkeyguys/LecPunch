import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NotificationPayload, NotificationSourceType, NotificationType } from '@lecpunch/shared';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({
  collection: 'notifications',
  timestamps: { createdAt: true, updatedAt: false }
})
export class Notification {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String, enum: ['attendance.record_marked'] })
  type!: NotificationType;

  @Prop({ required: true, type: String })
  title!: string;

  @Prop({ required: true, type: String })
  message!: string;

  @Prop({ required: true, type: SchemaTypes.Mixed })
  payload!: NotificationPayload;

  @Prop({ required: true, type: String, enum: ['attendance_record'] })
  sourceType!: NotificationSourceType;

  @Prop({ required: true, type: String })
  sourceId!: string;

  @Prop({ required: true, type: String })
  createdBy!: string;

  @Prop({ type: Date, default: null, index: true })
  acknowledgedAt!: Date | null;

  createdAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, acknowledgedAt: 1, createdAt: -1 });
NotificationSchema.index({ teamId: 1, userId: 1, createdAt: -1 });
NotificationSchema.index({ sourceType: 1, sourceId: 1 });
