import { RankingSnapshotsModule } from '../rankings/snapshots/ranking-snapshots.module';
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Vote, VoteSchema } from '../votes/schemas/vote.schema';
import { VotesModule } from '../votes/votes.module';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';

@Module({
  imports: [
    RankingSnapshotsModule,
    EventsModule,
    VotesModule,
    MongooseModule.forFeature([
      { name: Vote.name, schema: VoteSchema },
      { name: Event.name, schema: EventSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RankingsController],
  providers: [RankingsService],
})
export class RankingsModule {}
