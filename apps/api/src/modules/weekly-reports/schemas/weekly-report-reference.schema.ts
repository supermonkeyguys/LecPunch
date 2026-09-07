import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WeeklyReportStatus = 'generated' | 'missing' | 'pending';

@Schema({ timestamps: true, collection: 'weekly_report_references' })
export class WeeklyReportReference {
  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String, index: true })
  weekKey!: string;

  @Prop({ type: String, default: null })
  githubPath!: string | null;

  @Prop({ type: String, default: null })
  rawUrl!: string | null;

  @Prop({ type: String, default: null })
  commitSha!: string | null;

  @Prop({ required: true, type: Number, min: 0, max: 7, default: 0 })
  dailyLogCount!: number;

  @Prop({ required: true, type: String, enum: ['generated', 'missing', 'pending'], default: 'pending' })
  status!: WeeklyReportStatus;

  @Prop({ type: Date, default: null })
  generatedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WeeklyReportReferenceDocument = HydratedDocument<WeeklyReportReference>;
export const WeeklyReportReferenceSchema = SchemaFactory.createForClass(WeeklyReportReference);

WeeklyReportReferenceSchema.index({ userId: 1, weekKey: 1 }, { unique: true });
WeeklyReportReferenceSchema.index({ weekKey: 1, userId: 1 });
