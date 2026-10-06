import { Injectable } from '@nestjs/common';
import { UserDocument } from '../users/schemas/user.schema';
import { VotesService } from '../votes/votes.service';
import { Ranking } from './models/ranking.model';
import { RankingSnapshotsService } from './snapshots/ranking-snapshots.service';

@Injectable()
export class RankingsService {
  constructor(
    private readonly votesService: VotesService,
    private readonly snapshots: RankingSnapshotsService,
  ) {}

  async forEvent(eventId: string, user: UserDocument): Promise<Ranking> {
    const results = await this.votesService.results(eventId, user);
    return Ranking.from(results.candidates, results.totalPoints, {
      id: results.eventId,
      status: results.status,
    });
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
