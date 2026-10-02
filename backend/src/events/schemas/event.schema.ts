import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongoSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export enum EventStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export type EventDocument = HydratedDocument<Event>;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name!: string;

  @Prop({ required: true })
  date!: Date;

  @Prop({ maxlength: 2000 })
  description?: string;

  @Prop({ required: true, enum: EventStatus, default: EventStatus.DRAFT })
  status!: EventStatus;

  @Prop({ type: MongoSchema.Types.ObjectId, ref: User.name, required: true })
  createdBy!: Types.ObjectId;

  @Prop({
    type: [{ type: MongoSchema.Types.ObjectId, ref: User.name }],
    default: [],
  })
  participants!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;

  // Serializes voting with status changes through a write to the same document.
  @Prop({ default: 0, select: false })
  votingRevision!: number;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ participants: 1, date: -1 });
