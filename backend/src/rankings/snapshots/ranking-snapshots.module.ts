import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../../events/schemas/event.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { Vote, VoteSchema } from '../../votes/schemas/vote.schema';
import {
  RankingSnapshot,
  RankingSnapshotSchema,
} from './ranking-snapshot.schema';
import { RankingSnapshotsService } from './ranking-snapshots.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: User.name, schema: UserSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: RankingSnapshot.name, schema: RankingSnapshotSchema },
    ]),
  ],
  providers: [RankingSnapshotsService],
  exports: [RankingSnapshotsService],
})
export class RankingSnapshotsModule {}
