import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import { Event } from '../../events/schemas/event.schema';
import { User } from '../../users/schemas/user.schema';

@Schema({ _id: false })
export class VoteAllocation {
  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name, required: true })
  votedUserId!: Types.ObjectId;
  @Prop({ required: true, enum: [5, 3, 1] })
  points!: number;
}
const VoteAllocationSchema = SchemaFactory.createForClass(VoteAllocation);
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Vote {
  @Prop({ type: MongoSchema.Types.ObjectId, ref: Event.name, required: true })
  eventId!: Types.ObjectId;

  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name, required: true })
  voterId!: Types.ObjectId;

  // Legacy ballots are read as one point.
  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name })
  votedUserId?: Types.ObjectId;
  @Prop({
    type: [VoteAllocationSchema],
    required: true,
    default: undefined,
    validate: {
      validator: (entries: VoteAllocation[]) =>
        entries.length === 3 &&
        entries.every((entry, index) => entry.points === [5, 3, 1][index]) &&
        new Set(entries.map((entry) => entry.votedUserId.toHexString()))
          .size === 3,
      message: 'Allocate 5, 3 and 1 points to three distinct candidates',
    },
  })
  allocations!: VoteAllocation[];
  createdAt!: Date;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);
VoteSchema.index({ eventId: 1, voterId: 1 }, { unique: true });
