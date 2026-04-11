import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TeamStatus } from '@lecpunch/shared';

@Schema({ timestamps: true, collection: 'teams' })
export class Team {
  @Prop({ required: true, type: String })
  name!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  })
  status!: TeamStatus;
}

export type TeamDocument = HydratedDocument<Team>;
export const TeamSchema = SchemaFactory.createForClass(Team);
