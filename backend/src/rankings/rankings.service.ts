import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { EventStatus } from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Ranking } from './models/ranking.model';
import { RankingSnapshotsService } from './snapshots/ranking-snapshots.service';

@Injectable()
export class RankingsService {
  constructor(
    private readonly snapshots: RankingSnapshotsService,
    private readonly eventsService: EventsService,
  ) {}

  async forEvent(eventId: string, user: UserDocument): Promise<Ranking> {
    // Check authorization before exposing the saved participant names and scores.
    const event = await this.eventsService.getDetail(eventId, user);
    if (event.status !== EventStatus.CLOSED)
      throw new ConflictException(
        'Results are only available after the event closes',
      );
    const snapshot = await this.snapshots.forEvent(event.id);
    if (!snapshot?.eventRanking)
      throw new ServiceUnavailableException(
        'Event snapshot is not available yet',
      );
    return snapshot.eventRanking;
  }

  async general(): Promise<Ranking & { calculatedAt?: string }> {
    const snapshot = await this.snapshots.latest();
    return snapshot?.generalRanking
      ? {
          ...snapshot.generalRanking,
          calculatedAt: snapshot.calculatedAt?.toISOString(),
        }
      : Ranking.from([], 0);
  }
}
