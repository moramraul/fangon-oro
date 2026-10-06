import { RankingSnapshotsModule } from '../rankings/snapshots/ranking-snapshots.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminEventsController, EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, EventSchema } from './schemas/event.schema';
import { Vote, VoteSchema } from '../votes/schemas/vote.schema';

@Module({
  imports: [
    RankingSnapshotsModule,
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: Vote.name, schema: VoteSchema },
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
