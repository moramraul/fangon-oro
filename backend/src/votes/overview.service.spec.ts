import { Ranking } from '../rankings/models/ranking.model';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { EditionsService } from '../editions/editions.service';
import { EventsService } from '../events/events.service';
import { Event } from '../events/schemas/event.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { Vote } from './schemas/vote.schema';
import { OverviewService } from './overview.service';
describe('OverviewService with explicit editions', () => {
  const userId = new Types.ObjectId();
  const editionId = new Types.ObjectId();
  const oldId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const edition = {
    _id: editionId,
    name: 'Current',
    number: 2027,
    status: 'open',
    opensAt: new Date('2026-12-20'),
    expectedEndsAt: new Date('2027-12-31'),
  };
  const event = {
    _id: eventId,
    editionId,
    name: 'Christmas',
    startDate: new Date('2026-12-20'),
    endDate: new Date('2026-12-21'),
    status: 'closed',
    participants: [userId],
  };
  const entry = {
    id: userId.toHexString(),
    name: 'Saved',
    avatar: 'saved.jpg',
    points: 5,
    fivePointVotes: 1,
    threePointVotes: 0,
    percentage: 100,
    position: 1,
  };
  const events = { find: jest.fn(), findById: jest.fn() };
  const votes = { distinct: jest.fn() };
  const lifecycle = { closeExpired: jest.fn() };
  const snapshots = {
    withParticipation: jest.fn(),
    withProfiles: jest.fn(async (ranking) => ranking),
    latest: jest.fn(),
    forEvent: jest.fn(),
  };
  const editions = {
    current: jest.fn(),
    find: jest.fn(),
    summary: jest.fn(),
    list: jest.fn(),
  };
  let service: OverviewService;
  beforeEach(() => {
    jest.resetAllMocks();
    snapshots.withProfiles.mockImplementation(async (ranking) => ranking);
    snapshots.withParticipation.mockImplementation(
      async (entries: Ranking['entries']) =>
        Ranking.from(
          entries,
          entries.reduce((sum, entry) => sum + entry.points, 0),
        ),
    );
    events.find.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([event]) }),
    });
    votes.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([eventId]),
    });
    editions.current.mockResolvedValue(edition);
    editions.summary.mockReturnValue({
      id: editionId.toHexString(),
      name: edition.name,
      number: 2027,
    });
    editions.list.mockResolvedValue([]);
    snapshots.latest.mockResolvedValue({
      editions: { [editionId.toHexString()]: [entry] },
    });
    service = new OverviewService(
      events as unknown as Model<Event>,
      votes as unknown as Model<Vote>,
      lifecycle as unknown as EventsService,
      snapshots as unknown as RankingSnapshotsService,
      editions as unknown as EditionsService,
    );
  });

  it('hides the active general ranking from participants while preserving events', async () => {
    const result = await service.overview({
      _id: userId,
      role: 'USER',
    } as UserDocument);
    expect(result.standings).toEqual([]);
    expect(result.publication.state).toBe('hidden');
    expect(result.events).toHaveLength(1);
  });

  it('keeps normal rankings hidden during the reveal and publishes only the special view', async () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...entry,
      id: String(index),
      position: index + 1,
    }));
    editions.find.mockResolvedValue({
      ...edition,
      status: 'closed',
      closedAt: new Date(),
      finalRanking: { entries },
    });
    const user = { _id: userId, role: 'USER' } as UserDocument;
    const regular = await service.overview(user, editionId.toHexString());
    expect(regular.standings).toEqual([]);
    const reveal = await service.overview(user, editionId.toHexString(), true);
    expect(reveal.standings.map((person) => person.rank)).toEqual([
      8, 9, 10, 11, 12,
    ]);
    editions.find.mockResolvedValue({
      ...edition,
      status: 'closed',
      closedAt: new Date(Date.now() - 3600000),
      finalRanking: { entries },
    });
    expect(
      (await service.overview(user, editionId.toHexString())).standings,
    ).toHaveLength(12);
  });
  it('blocks event results until the winner is revealed', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    editions.find.mockResolvedValue(edition);
    await expect(
      service.results(eventId.toHexString(), 'USER'),
    ).rejects.toMatchObject({ status: 409 });
    expect(snapshots.forEvent).not.toHaveBeenCalled();
    editions.find.mockResolvedValue({
      ...edition,
      status: 'closed',
      closedAt: new Date(Date.now() - 3600000),
      finalRanking: { entries: [entry] },
    });
    snapshots.forEvent.mockResolvedValue({
      eventRanking: { entries: [entry] },
    });
    expect(
      (await service.results(eventId.toHexString(), 'USER')).standings,
    ).toHaveLength(1);
  });
  it('includes Christmas in the newly active edition independent of the calendar year', async () => {
    const result = await service.overview({
      _id: userId,
      role: 'ADMIN',
    } as UserDocument);
    expect(result.year).toBe(2027);
    expect(events.find).toHaveBeenCalledWith({ editionId });
    expect(result.events[0].hasVoted).toBe(true);
    expect(result.standings[0]).toMatchObject({ name: 'Saved', rank: 1 });
  });
  it('starts from zero when only previous edition snapshots exist', async () => {
    snapshots.latest.mockResolvedValue({
      editions: { [oldId.toHexString()]: [entry] },
    });
    expect(
      (await service.overview({ _id: userId, role: 'ADMIN' } as UserDocument))
        .standings,
    ).toEqual([]);
  });
  it('reads previous final rankings and historical totals', async () => {
    editions.find.mockResolvedValue({
      ...edition,
      _id: oldId,
      status: 'closed',
      finalRanking: { entries: [entry] },
    });
    expect(
      (
        await service.overview(
          { _id: userId, role: 'ADMIN' } as UserDocument,
          oldId.toHexString(),
        )
      ).standings[0].name,
    ).toBe('Saved');
    snapshots.latest.mockResolvedValue({
      generalRanking: { entries: [entry] },
    });
    expect(
      (
        await service.overview(
          { _id: userId, role: 'ADMIN' } as UserDocument,
          'global',
        )
      ).scope,
    ).toBe('global');
  });
  it('reads final event names and photos without users or ballots, including earlier editions', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    snapshots.forEvent.mockResolvedValue({
      event: { name: 'Original', image: 'original.jpg' },
      eventRanking: { entries: [entry] },
    });
    expect(await service.results(eventId.toHexString(), 'ADMIN')).toMatchObject(
      {
        name: 'Original',
        image: 'original.jpg',
        editionId: editionId.toHexString(),
        standings: [{ ...entry, rank: 1 }],
      },
    );
  });
  it('does not expose results while voting is open', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...event, status: 'open' }),
    });
    await expect(
      service.results(eventId.toHexString(), 'ADMIN'),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(snapshots.forEvent).not.toHaveBeenCalled();
  });
  it('does not recalculate a missing final snapshot', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    snapshots.forEvent.mockResolvedValue(null);
    await expect(
      service.results(eventId.toHexString(), 'ADMIN'),
    ).rejects.toMatchObject({
      status: 503,
    });
  });
  it('rejects malformed and unassigned event IDs', async () => {
    await expect(service.results('invalid', 'ADMIN')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.results(eventId.toHexString(), 'ADMIN'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not expose test results as a partial classification', async () => {
    events.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...event, isTest: true }),
    });
    await expect(
      service.results(eventId.toHexString(), 'ADMIN'),
    ).rejects.toMatchObject({
      status: 409,
    });
    expect(snapshots.forEvent).not.toHaveBeenCalled();
  });
});
