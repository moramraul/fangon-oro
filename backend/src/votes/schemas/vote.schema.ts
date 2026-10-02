import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import { Event } from '../../events/schemas/event.schema';
import { User } from '../../users/schemas/user.schema';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Vote {
  @Prop({ type: MongoSchema.Types.ObjectId, ref: Event.name, required: true })
  eventId!: Types.ObjectId;

  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name, required: true })
  voterId!: Types.ObjectId;

  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name, required: true })
  votedUserId!: Types.ObjectId;

  createdAt!: Date;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);
VoteSchema.index({ eventId: 1, voterId: 1 }, { unique: true });
