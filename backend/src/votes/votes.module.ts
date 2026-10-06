import { RankingSnapshotsModule } from '../rankings/snapshots/ranking-snapshots.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [
    RankingSnapshotsModule,
    EventsModule,
    MongooseModule.forFeature([
      { name: Vote.name, schema: VoteSchema },
      { name: Event.name, schema: EventSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [VotesController, OverviewController],
  providers: [VotesService, OverviewService],
  exports: [VotesService],
})
export class VotesModule {}
