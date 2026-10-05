import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, default: false })
  isActive!: boolean;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: false })
  avatar?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop({ select: false })
  passwordResetRequestedAt?: Date;

  @Prop({ default: 0 })
  sessionVersion!: number;

  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;

  @Prop({ default: false })
  passwordPromptSeen!: boolean;

  @Prop({ required: true, enum: ['USER', 'ADMIN'], default: 'USER' })
  role!: 'USER' | 'ADMIN';
}

export const UserSchema = SchemaFactory.createForClass(User);
