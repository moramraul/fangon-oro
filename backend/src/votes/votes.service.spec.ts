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
  const eventId = new Types.ObjectId();
  const user = { _id: voterId, role: 'USER' } as UserDocument;
  const vote = {
    eventId,
    voterId,
    votedUserId: candidateId,
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
  let service: VotesService;

  beforeEach(() => {
    jest.resetAllMocks();
    votes.countDocuments.mockReturnValue({
      session: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
    });
    events.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    details.getDetail.mockResolvedValue({
      id: eventId.toHexString(),
      status: EventStatus.OPEN,
      participantCount: 2,
      participants: [
        { id: voterId.toHexString(), name: 'Davo' },
        { id: candidateId.toHexString(), name: 'Héctor' },
      ],
    });
    connection.transaction.mockImplementation(
      (callback: (session: ClientSession) => Promise<unknown>) =>
        callback(session),
    );
    events.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: eventId,
        participants: [voterId, candidateId],
      }),
    });
    votes.create.mockResolvedValue([vote]);
    service = new VotesService(
      votes as unknown as Model<Vote>,
      events as unknown as Model<Event>,
      connection as unknown as Connection,
      details as unknown as EventsService,
    );
  });

  it('rejects an ADMIN who is not a participant', async () => {
    await expect(
      service.cast(eventId.toHexString(), candidateId.toHexString(), {
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
          voterId.toHexString().toUpperCase(),
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
        new Types.ObjectId().toHexString(),
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(votes.create).not.toHaveBeenCalled();
  });

  it('checks OPEN and both participants inside the transaction', async () => {
    const result = await service.cast(
      eventId.toHexString(),
      candidateId.toHexString(),
      user,
    );
    expect(events.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: eventId.toHexString(),
        status: EventStatus.OPEN,
        startDate: { $lte: expect.any(Date) as Date },
        endDate: { $gt: expect.any(Date) as Date },
        participants: { $all: [voterId, candidateId] },
      },
      { $inc: { votingRevision: 1 } },
      { session, new: true },
    );
    expect(votes.create).toHaveBeenCalledWith(
      [{ eventId, voterId, votedUserId: candidateId }],
      { session },
    );
    expect(result).not.toHaveProperty('voterId');
  });

  it('closes after the last vote', async () => {
    votes.countDocuments.mockReturnValue({
      session: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(2) }),
    });
    await service.cast(eventId.toHexString(), candidateId.toHexString(), user);
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: eventId, status: EventStatus.OPEN },
      { $set: { status: EventStatus.CLOSED } },
      { session },
    );
  });
  it('does not insert a vote when the event has closed', async () => {
    events.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.cast(eventId.toHexString(), candidateId.toHexString(), user),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(votes.create).not.toHaveBeenCalled();
  });

  it('translates duplicate index errors to 409', async () => {
    votes.create.mockRejectedValue({ code: 11000 });
    await expect(
      service.cast(eventId.toHexString(), candidateId.toHexString(), user),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(VoteSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ eventId: 1, voterId: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });

  it('includes zero-vote candidates and no leaders before votes exist', async () => {
    votes.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    const result = await service.results(eventId.toHexString(), user);
    expect(result.totalVotes).toBe(0);
    expect(result.leaderIds).toEqual([]);
    expect(result.candidates).toHaveLength(2);
    expect(
      result.candidates.every((candidate) => candidate.percentage === 0),
    ).toBe(true);
  });

  it('reports all tied leaders', async () => {
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: voterId, votes: 1 },
        { _id: candidateId, votes: 1 },
      ]),
    });
    const result = await service.results(eventId.toHexString(), user);
    expect(result.totalVotes).toBe(2);
    expect(result.participationPercentage).toBe(100);
    expect(result.leaderIds).toEqual(
      expect.arrayContaining([
        voterId.toHexString(),
        candidateId.toHexString(),
      ]),
    );
    expect(result.candidates.map((candidate) => candidate.percentage)).toEqual([
      50, 50,
    ]);
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
});
