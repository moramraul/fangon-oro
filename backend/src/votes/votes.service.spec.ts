import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import { Event, EventStatus } from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { VotesService } from './votes.service';

describe('VotesService', () => {
  const voterId = new Types.ObjectId();
  const candidateId = new Types.ObjectId();
  const secondId = new Types.ObjectId();
  const thirdId = new Types.ObjectId();
  const selections = [candidateId, secondId, thirdId].map((id) =>
    id.toHexString(),
  );
  const eventId = new Types.ObjectId();
  const user = { _id: voterId, role: 'USER' } as UserDocument;
  const vote = {
    eventId,
    voterId,
    allocations: [candidateId, secondId, thirdId].map((id, i) => ({
      votedUserId: id,
      points: [5, 3, 1][i],
    })),
    createdAt: new Date(),
  };
  const session = {} as ClientSession;
  const votes = {
    create: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  };
  const events = { findOneAndUpdate: jest.fn(), updateOne: jest.fn() };
  const details = { getDetail: jest.fn() };
  const connection = { transaction: jest.fn() };
  const snapshots = { capture: jest.fn(), forEvent: jest.fn() };
  let service: VotesService;

  beforeEach(() => {
    jest.resetAllMocks();
    votes.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
      session: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    });
    events.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    details.getDetail.mockResolvedValue({
      id: eventId.toHexString(),
      status: EventStatus.OPEN,
      participantCount: 4,
      participants: [
        { id: voterId.toHexString(), name: 'Davo' },
        { id: candidateId.toHexString(), name: 'Candidate' },
        { id: secondId.toHexString(), name: 'Second' },
        { id: thirdId.toHexString(), name: 'Third' },
      ],
    });
    connection.transaction.mockImplementation(
      (callback: (session: ClientSession) => Promise<unknown>) =>
        callback(session),
    );
    events.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: eventId,
        participants: [voterId, candidateId, secondId, thirdId],
      }),
    });
    votes.create.mockResolvedValue([vote]);
    service = new VotesService(
      votes as unknown as Model<Vote>,
      events as unknown as Model<Event>,
      connection as unknown as Connection,
      details as unknown as EventsService,
      snapshots as unknown as RankingSnapshotsService,
    );
  });

  it('rejects an ADMIN who is not a participant', async () => {
    await expect(
      service.cast(eventId.toHexString(), selections, {
        _id: new Types.ObjectId(),
        role: 'ADMIN',
      } as UserDocument),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(connection.transaction).not.toHaveBeenCalled();
  });

  it.each(['USER', 'ADMIN'])(
    'rejects self-votes by a %s participant',
    async (role) => {
      await expect(
        service.cast(
          eventId.toHexString(),
          [
            voterId.toHexString().toUpperCase(),
            secondId.toHexString(),
            thirdId.toHexString(),
          ],
          {
            _id: voterId,
            role,
          } as UserDocument,
        ),
      ).rejects.toThrow(
        new BadRequestException('You cannot vote for yourself'),
      );
      expect(connection.transaction).not.toHaveBeenCalled();
      expect(votes.create).not.toHaveBeenCalled();
    },
  );

  it('rejects candidates outside the event', async () => {
    await expect(
      service.cast(
        eventId.toHexString(),
        [
          new Types.ObjectId().toHexString(),
          secondId.toHexString(),
          thirdId.toHexString(),
        ],
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(votes.create).not.toHaveBeenCalled();
  });

  it('checks OPEN and all participants inside the transaction', async () => {
    const result = await service.cast(eventId.toHexString(), selections, user);
    expect(events.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: eventId.toHexString(),
        status: EventStatus.OPEN,
        startDate: { $lte: expect.any(Date) as Date },
        endDate: { $gt: expect.any(Date) as Date },
        participants: { $all: [voterId, candidateId, secondId, thirdId] },
      },
      { $inc: { votingRevision: 1 } },
      { session, new: true },
    );
    expect(votes.create).toHaveBeenCalledWith(
      [{ eventId, voterId, allocations: vote.allocations }],
      { session },
    );
    expect(result).not.toHaveProperty('voterId');
    expect(result.allocations.map((entry) => entry.points)).toEqual([5, 3, 1]);
  });

  it('closes after the last vote', async () => {
    votes.countDocuments.mockReturnValue({
      session: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(4) }),
    });
    await service.cast(eventId.toHexString(), selections, user);
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: eventId, status: EventStatus.OPEN },
      { $set: { status: EventStatus.CLOSED } },
      { session },
    );
  });
  it('saves the snapshot in the final vote transaction', async () => {
    votes.countDocuments.mockReturnValue({
      session: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(4) }),
    });
    await service.cast(eventId.toHexString(), selections, user);
    expect(snapshots.capture).toHaveBeenCalledWith(
      eventId.toHexString(),
      session,
    );
  });

  it('does not snapshot provisional voting', async () => {
    await service.cast(eventId.toHexString(), selections, user);
    expect(snapshots.capture).not.toHaveBeenCalled();
  });

  it('does not insert a vote when the event has closed', async () => {
    events.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.cast(eventId.toHexString(), selections, user),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(votes.create).not.toHaveBeenCalled();
  });

  it('translates duplicate index errors to 409', async () => {
    votes.create.mockRejectedValue({ code: 11000 });
    await expect(
      service.cast(eventId.toHexString(), selections, user),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(VoteSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ eventId: 1, voterId: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });

  it('does not query results of an inaccessible event', async () => {
    details.getDetail.mockRejectedValue(new NotFoundException());
    await expect(
      service.results(eventId.toHexString(), user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('returns null when the user has not voted', async () => {
    votes.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    await expect(service.mine(eventId.toHexString(), user)).resolves.toBeNull();
    expect(votes.findOne).toHaveBeenCalledWith({
      eventId: eventId.toHexString(),
      voterId,
    });
  });
  it('rejects repeated candidates after normalizing IDs', async () => {
    await expect(
      service.cast(
        eventId.toHexString(),
        [selections[0], selections[0].toUpperCase(), selections[2]],
        user,
      ),
    ).rejects.toThrow('Candidates must be distinct');
    expect(votes.create).not.toHaveBeenCalled();
  });

  it('returns the own ballot with all allocations', async () => {
    votes.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(vote) });
    const result = await service.mine(eventId.toHexString(), user);
    expect(result?.allocations.map((entry) => entry.points)).toEqual([5, 3, 1]);
  });
  it('reads historical single-candidate votes as one point', async () => {
    votes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        eventId,
        voterId,
        votedUserId: candidateId,
        createdAt: vote.createdAt,
      }),
    });
    expect(
      (await service.mine(eventId.toHexString(), user))?.allocations,
    ).toEqual([{ votedUserId: candidateId.toHexString(), points: 1 }]);
  });
  it.each(['USER', 'ADMIN'])(
    'rejects open results for %s without reading scores',
    async (role) => {
      await expect(
        service.results(eventId.toHexString(), {
          ...user,
          role,
        } as UserDocument),
      ).rejects.toMatchObject({ status: 409 });
      expect(votes.aggregate).not.toHaveBeenCalled();
      expect(snapshots.forEvent).not.toHaveBeenCalled();
    },
  );
  it('reads final results from the snapshot after users are deleted', async () => {
    details.getDetail.mockResolvedValue({
      id: eventId.toHexString(),
      status: EventStatus.CLOSED,
      participants: [],
    });
    const entry = {
      id: candidateId.toHexString(),
      name: 'Original',
      points: 9,
      fivePointVotes: 1,
      threePointVotes: 1,
      percentage: 100,
      position: 1,
    };
    snapshots.forEvent.mockResolvedValue({
      eventRanking: { entries: [entry], totalPoints: 9, leaderIds: [entry.id] },
      totalVotes: 1,
      participantCount: 4,
    });
    const result = await service.results(eventId.toHexString(), user);
    expect(result.candidates).toEqual([entry]);
    expect(result.participationPercentage).toBe(25);
    expect(votes.aggregate).not.toHaveBeenCalled();
  });
});
