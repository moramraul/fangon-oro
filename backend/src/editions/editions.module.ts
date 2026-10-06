import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { RankingSnapshotsModule } from '../rankings/snapshots/ranking-snapshots.module';
import { Edition, EditionSchema } from './edition.schema';
import { EditionsService } from './editions.service';
import { EditionsController } from './editions.controller';

@Module({
  imports: [
    RankingSnapshotsModule,
    MongooseModule.forFeature([
      { name: Edition.name, schema: EditionSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [EditionsController],
  providers: [EditionsService],
  exports: [EditionsService],
})
export class EditionsModule {}
