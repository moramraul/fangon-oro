import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema } from 'mongoose';
import { Ranking, RankingEntry } from '../models/ranking.model';

export interface SnapshotEntry extends RankingEntry {
  avatar: string | null;
}

@Schema({ collection: 'ranking_snapshots' })
export class RankingSnapshot {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true, default: 0 })
  revision!: number;

  @Prop()
  calculatedAt?: Date;

  @Prop()
  totalVotes?: number;

  @Prop()
  participantCount?: number;

  @Prop({ type: MongoSchema.Types.Mixed })
  event?: {
    id: string;
    name: string;
    image?: string | null;
    startDate: Date;
    endDate?: Date;
    year: number;
  };

  @Prop({ type: MongoSchema.Types.Mixed })
  eventRanking?: Ranking & { entries: SnapshotEntry[] };

  @Prop({ type: MongoSchema.Types.Mixed })
  generalRanking?: Ranking;

  @Prop({ type: MongoSchema.Types.Mixed })
  editions?: Record<string, SnapshotEntry[]>;
}

export const RankingSnapshotSchema =
  SchemaFactory.createForClass(RankingSnapshot);
RankingSnapshotSchema.index({ key: 1 }, { unique: true });
RankingSnapshotSchema.index({ revision: -1 });
