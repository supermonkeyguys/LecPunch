import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TeamEventStatus } from '@lecpunch/shared';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'team_events' })
export class TeamEvent {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String })
  title!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ required: true, type: Date })
  eventAt!: Date;

  @Prop({
    required: true,
    type: String,
    enum: ['planned', 'done', 'cancelled'],
    default: 'planned'
  })
  status!: TeamEventStatus;

  @Prop({ required: true, type: String })
  createdBy!: string;

  @Prop({ required: true, type: String })
  updatedBy!: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type TeamEventDocument = HydratedDocument<TeamEvent>;
export const TeamEventSchema = SchemaFactory.createForClass(TeamEvent);

TeamEventSchema.index({ teamId: 1, eventAt: -1 });
TeamEventSchema.index({ teamId: 1, status: 1, eventAt: -1 });
