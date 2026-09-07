import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'github_sources' })
export class GitHubSource {
  @Prop({ required: true, type: String, unique: true })
  userId!: string;

  @Prop({ required: true, type: String })
  repoUrl!: string;

  @Prop({ required: true, type: String, default: 'main' })
  branch!: string;

  @Prop({ required: true, type: String, default: 'lecpunch/index.json' })
  indexPath!: string;

  @Prop({ required: true, type: String, enum: ['public'], default: 'public' })
  accessMode!: 'public';

  @Prop({ required: true, type: Boolean, default: true })
  enabled!: boolean;

  @Prop({ type: String, default: null })
  siteUrl!: string | null;

  @Prop({ type: Date, default: null })
  verifiedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type GitHubSourceDocument = HydratedDocument<GitHubSource>;
export const GitHubSourceSchema = SchemaFactory.createForClass(GitHubSource);
