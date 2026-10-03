import { Score } from '../votes/score';
import { pointsPipeline } from '../votes/points.pipeline';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Vote } from '../votes/schemas/vote.schema';
import { VotesService } from '../votes/votes.service';
import { Ranking } from './models/ranking.model';

@Injectable()
export class RankingsService {
  constructor(
    @InjectModel(Vote.name) private readonly voteModel: Model<Vote>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly votesService: VotesService,
  ) {}

  async forEvent(eventId: string, user: UserDocument): Promise<Ranking> {
    const results = await this.votesService.results(eventId, user);
    return Ranking.from(results.candidates, results.totalPoints, {
      id: results.eventId,
      status: results.status,
    });
  }

  async general(): Promise<Ranking> {
    const counts = await this.voteModel
      .aggregate<{ _id: Types.ObjectId } & Score>([...pointsPipeline()])
      .exec();
    const participantIds = await this.eventModel
      .distinct('participants')
      .exec();
    const ids = [
      ...new Set([
        ...participantIds.map((id: Types.ObjectId) => id.toHexString()),
        ...counts.map((entry) => entry._id.toHexString()),
      ]),
    ];
    const users = await this.userModel
      .find({ _id: { $in: ids } })
      .select('_id name')
      .exec();
    const names = new Map(
      users.map((user) => [user._id.toHexString(), user.name]),
    );
    const points = new Map(
      counts.map((entry) => [entry._id.toHexString(), entry]),
    );
    return Ranking.from(
      ids.map((id) => ({
        id,
        name: names.get(id) ?? 'Usuario eliminado',
        points: points.get(id)?.points ?? 0,
        fivePointVotes: points.get(id)?.fivePointVotes ?? 0,
        threePointVotes: points.get(id)?.threePointVotes ?? 0,
      })),
      counts.reduce((total, entry) => total + entry.points, 0),
    );
  }
}
