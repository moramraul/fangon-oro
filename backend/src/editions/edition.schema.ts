import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema, Types } from 'mongoose';
import { Ranking } from '../rankings/models/ranking.model';

@Schema({ collection: 'editions', timestamps: true })
export class Edition {
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) number!: number;
  @Prop({ required: true, enum: ['open', 'closed'] }) status!:
    'open' | 'closed';
  @Prop({ required: true }) opensAt!: Date;
  @Prop({ required: true }) expectedEndsAt!: Date;
  @Prop() closedAt?: Date;
  @Prop({ type: MongoSchema.Types.ObjectId }) closedBy?: Types.ObjectId;
  @Prop({ default: 0 }) revision!: number;
  @Prop({ type: MongoSchema.Types.Mixed }) finalRanking?: Ranking;
}
export const EditionSchema = SchemaFactory.createForClass(Edition);
EditionSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);
EditionSchema.index({ number: 1 }, { unique: true });
