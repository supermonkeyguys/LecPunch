import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from '@lecpunch/shared';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, index: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true })
  displayName!: string;

  @Prop({ required: true, type: String, index: true })
  teamId!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['member', 'admin'],
    default: 'member'
  })
  role!: UserRole;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  })
  status!: UserStatus;

  @Prop({ required: true, type: Number })
  enrollYear!: number;

  @Prop({ sparse: true, unique: true, index: true })
  studentId?: string;

  @Prop()
  realName?: string;

  @Prop()
  avatarBase64?: string;

  @Prop()
  avatarColor?: string;

  @Prop()
  avatarEmoji?: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ teamId: 1, role: 1 });
