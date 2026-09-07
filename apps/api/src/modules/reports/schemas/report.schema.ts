import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ReportImage {
  @Prop({ required: true, type: String })
  id!: string;

  @Prop({ required: true, type: String })
  filename!: string;

  @Prop({ required: true, type: String })
  contentType!: string;

  @Prop({ required: true, type: Number })
  sizeBytes!: number;
}

export const ReportImageSchema = SchemaFactory.createForClass(ReportImage);

@Schema({
  collection: 'reports',
  timestamps: { createdAt: true, updatedAt: true }
})
export class Report {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String, index: true })
  reporterUserId!: string;

  @Prop({ required: true, type: String })
  reporterUsername!: string;

  @Prop({ required: true, type: String })
  reporterDisplayName!: string;

  @Prop({ required: true, type: String, maxlength: 2_000 })
  description!: string;

  @Prop({ required: true, type: [ReportImageSchema], default: [] })
  images!: ReportImage[];

  @Prop({ type: Date, default: null, index: true })
  imagesExpireAt!: Date | null;

  @Prop({ type: Date, default: null })
  imagesPurgedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ teamId: 1, createdAt: -1 });
ReportSchema.index({ imagesExpireAt: 1, imagesPurgedAt: 1 });
