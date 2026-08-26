import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ required: false, unique: true, sparse: true })
  googleId?: string;

  @Prop({ required: true, enum: ['USER', 'ADMIN'], default: 'USER' })
  role!: 'USER' | 'ADMIN';
}

export const UserSchema = SchemaFactory.createForClass(User);
