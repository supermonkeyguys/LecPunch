import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MemberEligibilityStatus } from '@lecpunch/shared';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'member_eligibilities' })
export class MemberEligibility {
  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({ required: true, type: String })
  studentId!: string;

  @Prop({ required: true, type: String })
  realName!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['allowed', 'blocked'],
    default: 'allowed'
  })
  status!: MemberEligibilityStatus;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type MemberEligibilityDocument = HydratedDocument<MemberEligibility>;
export const MemberEligibilitySchema = SchemaFactory.createForClass(MemberEligibility);

MemberEligibilitySchema.index({ teamId: 1, studentId: 1 }, { unique: true });
MemberEligibilitySchema.index({ teamId: 1, updatedAt: -1 });
