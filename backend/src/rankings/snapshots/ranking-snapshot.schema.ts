import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongoSchema } from 'mongoose';
import { Ranking, RankingEntry } from '../models/ranking.model';

export type SnapshotEntry = Omit<RankingEntry, 'name' | 'avatar'>;
export type SnapshotRanking = Omit<Ranking, 'entries'> & {
  entries: SnapshotEntry[];
};

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
    editionId: string;
  };

  @Prop({ type: MongoSchema.Types.Mixed })
  eventRanking?: SnapshotRanking;

  @Prop({ type: MongoSchema.Types.Mixed })
  generalRanking?: SnapshotRanking;

  @Prop({ type: MongoSchema.Types.Mixed })
  editions?: Record<string, SnapshotEntry[]>;
}

export const RankingSnapshotSchema =
  SchemaFactory.createForClass(RankingSnapshot);
RankingSnapshotSchema.index({ key: 1 }, { unique: true });
RankingSnapshotSchema.index({ revision: -1 });
