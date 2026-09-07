import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'skin_unlocks' })
export class SkinUnlock {
  @Prop({ required: true, type: String, index: true })
  userId!: string;

  @Prop({ required: true, type: String })
  skinId!: string;

  @Prop({ required: true, type: Date, default: Date.now })
  unlockedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SkinUnlockDocument = HydratedDocument<SkinUnlock>;
export const SkinUnlockSchema = SchemaFactory.createForClass(SkinUnlock);

SkinUnlockSchema.index({ userId: 1, skinId: 1 }, { unique: true });
