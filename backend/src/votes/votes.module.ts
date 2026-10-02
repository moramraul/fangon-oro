import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';
import { Vote, VoteSchema } from './schemas/vote.schema';

@Module({
  imports: [
    EventsModule,
    MongooseModule.forFeature([
      { name: Vote.name, schema: VoteSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
