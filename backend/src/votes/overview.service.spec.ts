import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { EventsService } from '../events/events.service';
import { Event } from '../events/schemas/event.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Vote } from './schemas/vote.schema';
import { OverviewService } from './overview.service';

describe('OverviewService', () => {
  const a = new Types.ObjectId();
  const b = new Types.ObjectId();
  const previous = {
    _id: new Types.ObjectId(),
    name: 'Anterior',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-06-02'),
    status: 'closed',
    participants: [a, b],
  };
  const upcoming = {
    _id: new Types.ObjectId(),
    name: 'Nueva edición',
    startDate: new Date('2027-02-01'),
    endDate: new Date('2027-02-02'),
    status: 'open',
    participants: [a],
  };
  const events = { find: jest.fn(), findById: jest.fn() };
  const votes = { aggregate: jest.fn(), distinct: jest.fn() };
  const users = { find: jest.fn() };
  const lifecycle = { closeExpired: jest.fn() };
  let service: OverviewService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:00:00Z'));
    jest.resetAllMocks();
    votes.distinct.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    events.find.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({
          exec: jest.fn().mockResolvedValue([upcoming, previous]),
        }),
    });
    votes.aggregate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([
          { _id: a, points: 5, fivePointVotes: 1, threePointVotes: 0 },
        ]),
    });
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: a, name: 'Ana' },
          { _id: b, name: 'Bea' },
        ]),
      }),
    });
    service = new OverviewService(
      events as unknown as Model<Event>,
      votes as unknown as Model<Vote>,
      users as unknown as Model<User>,
      lifecycle as unknown as EventsService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('shows only current events while accumulating only the previous edition until the first start', async () => {
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.year).toBe(2027);
    expect(result.rankingYear).toBe(2026);
    expect(result.events.map((event) => event.id)).toEqual([
      upcoming._id.toHexString(),
    ]);
    expect(result.events[0].canVote).toBe(true);
    expect(votes.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { eventId: { $in: [previous._id] } },
    });
    expect(
      result.standings.map(({ name, points, rank }) => ({
        name,
        points,
        rank,
      })),
    ).toEqual([
      { name: 'Ana', points: 5, rank: 1 },
      { name: 'Bea', points: 0, rank: 2 },
    ]);
  });

  it('resets the edition at the first start without including open event votes', async () => {
    jest.setSystemTime(upcoming.startDate);
    await service.overview({ _id: b } as UserDocument).then((result) => {
      expect(result.rankingYear).toBe(2027);
      expect(result.events[0].canVote).toBe(false);
      expect(result.standings).toEqual([]);
    });
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('keeps general standings unchanged while voting and includes the event after closing', async () => {
    jest.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    const open = { ...previous, _id: upcoming._id, status: 'open' };
    events.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([open, previous]),
      }),
    });

    const before = await service.overview({ _id: a } as UserDocument);
    const during = await service.overview({ _id: a } as UserDocument);
    expect(during.standings).toEqual(before.standings);
    for (const [pipeline] of votes.aggregate.mock.calls) {
      expect(pipeline[0]).toEqual({
        $match: { eventId: { $in: [previous._id] } },
      });
    }

    open.status = 'closed';
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: b, points: 10, fivePointVotes: 2, threePointVotes: 0 },
        { _id: a, points: 5, fivePointVotes: 1, threePointVotes: 0 },
      ]),
    });
    const after = await service.overview({ _id: a } as UserDocument);
    expect(votes.aggregate.mock.calls[2][0][0]).toEqual({
      $match: { eventId: { $in: [open._id, previous._id] } },
    });
    expect(after.standings[0]).toMatchObject({ name: 'Bea', points: 10 });
  });

  it('marks voted events for the current user in the overview', async () => {
    votes.distinct.mockReturnValue({ exec: jest.fn().mockResolvedValue([upcoming._id]) });
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.events[0].hasVoted).toBe(true);
    expect(votes.distinct).toHaveBeenCalledWith('eventId', { voterId: a });
  });

  it('shares places on sporting ties', async () => {
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: a, points: 3 },
        { _id: b, points: 3 },
      ]),
    });
    const result = await service.overview({ _id: a } as UserDocument);
    expect(result.standings.map((entry) => entry.rank)).toEqual([1, 1]);
  });

  it('rejects results from old editions and malformed event IDs', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(previous),
    });
    await expect(
      service.results(previous._id.toHexString()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.results('invalid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
