import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Event, EventStatus } from '../events/schemas/event.schema';
import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { Edition, EditionSchema } from './edition.schema';
import { EditionsService } from './editions.service';

function query(value: unknown) {
  const result = {
    exec: jest.fn().mockResolvedValue(value),
    sort: jest.fn(),
    session: jest.fn(),
  };
  result.sort.mockReturnValue(result);
  result.session.mockReturnValue(result);
  return result;
}
describe('EditionsService', () => {
  const id = new Types.ObjectId();
  const nextId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const session = {} as ClientSession;
  const edition = {
    _id: id,
    name: 'Fangón de Oro 2026',
    number: 2026,
    status: 'open',
    opensAt: new Date('2025-12-20'),
    expectedEndsAt: new Date('2026-12-31'),
  };
  const editions = {
    init: jest.fn(),
    exists: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn<
      Promise<unknown>,
      [Partial<Edition>[], { session: ClientSession }]
    >(),
  };
  const events = {
    create: jest.fn(),
    updateMany: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
  };
  const snapshots = {
    withoutProfiles: jest.fn(),
    initialize: jest.fn(),
    capture: jest.fn(),
    latest: jest.fn(),
    withProfiles: jest.fn(),
  };
  const connection = { transaction: jest.fn() };
  let service: EditionsService;
  beforeEach(() => {
    jest.resetAllMocks();
    snapshots.withoutProfiles.mockImplementation(
      RankingSnapshotsService.prototype.withoutProfiles,
    );
    jest.useFakeTimers().setSystemTime(new Date('2026-12-20T09:00:00Z'));
    editions.findOneAndUpdate.mockReturnValue(
      query({ ...edition, status: 'closed', closedAt: new Date() }),
    );
    editions.updateOne.mockReturnValue(query({}));
    editions.create.mockImplementation((data: Partial<Edition>[]) =>
      Promise.resolve([{ ...data[0], _id: nextId }]),
    );
    events.updateMany.mockReturnValue(query({}));
    events.exists.mockReturnValue(query(null));
    events.find.mockReturnValue(query([{ _id: eventId }]));
    snapshots.latest.mockResolvedValue({
      editions: {
        [id.toHexString()]: [
          {
            id: userId.toHexString(),
            name: 'Original',
            avatar: 'saved.jpg',
            points: 9,
            fivePointVotes: 1,
            threePointVotes: 1,
          },
        ],
      },
    });
    connection.transaction.mockImplementation(
      (callback: (session: ClientSession) => Promise<unknown>) =>
        callback(session),
    );
    service = new EditionsService(
      editions as unknown as Model<Edition>,
      events as unknown as Model<Event>,
      connection as unknown as Connection,
      snapshots as unknown as RankingSnapshotsService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('atomically finalizes the edition, expires pending deadlines and creates the next opening one minute later', async () => {
    const result = await service.close(id.toHexString(), userId);
    expect(result.closed.finalRanking.totalPoints).toBe(9);
    expect(result.closed.finalRanking.entries[0]).not.toHaveProperty('name');
    expect(result.closed.finalRanking.entries[0]).not.toHaveProperty('avatar');
    expect(result.opened.opensAt).toBe('2026-12-20T09:01:00.000Z');
    expect(result.opened.name).toBe('Fangón de Oro 2027');
    expect(result.opened.expectedEndsAt).toBe('2027-12-31T22:59:59.999Z');
    expect(events.updateMany).toHaveBeenCalledWith(
      {
        editionId: id,
        status: EventStatus.OPEN,
        endDate: { $lte: new Date() },
      },
      { $set: { status: EventStatus.CLOSED } },
      { session },
    );
    expect(snapshots.capture).toHaveBeenCalledWith(
      eventId.toHexString(),
      session,
    );
    expect(snapshots.latest).toHaveBeenCalledWith(session);
    expect(editions.create.mock.calls[0][1]).toEqual({ session });
    expect(connection.transaction).toHaveBeenCalledTimes(1);
  });

  it('blocks closure when an event still has time to vote', async () => {
    events.exists.mockReturnValue(query({ _id: eventId }));
    await expect(service.close(id.toHexString(), userId)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(editions.create).not.toHaveBeenCalled();
    expect(snapshots.capture).not.toHaveBeenCalled();
  });

  it('does not expose awards before edition closure', async () => {
    editions.findById.mockReturnValue(query(edition));
    await expect(service.winners(id.toHexString())).rejects.toMatchObject({
      status: 404,
    });
    expect(snapshots.latest).not.toHaveBeenCalled();
  });

  it('allows admin previews without saving awards or closing the edition', async () => {
    editions.findById.mockReturnValue(query(edition));
    snapshots.withProfiles.mockImplementation(async (ranking) => ranking);
    const result = await service.winners(id.toHexString(), 'ADMIN');
    expect(result.preview).toBe(true);
    expect(result.edition.status).toBe('open');
    expect(result.awards.gold[0].points).toBe(9);
    expect(editions.updateOne).not.toHaveBeenCalled();
    expect(editions.findOneAndUpdate).not.toHaveBeenCalled();
    expect(editions.create).not.toHaveBeenCalled();
  });

  it('allows admin previews before the first event closes', async () => {
    editions.findById.mockReturnValue(query(edition));
    snapshots.latest.mockResolvedValue(null);
    snapshots.withProfiles.mockImplementation(async (ranking) => ranking);
    const result = await service.winners(id.toHexString(), 'ADMIN');
    expect(result.preview).toBe(true);
    expect(result.awards.gold).toEqual([]);
    expect(result.awards.goldenUnderpants).toEqual([]);
  });

  it('serves legacy closed editions from the frozen ranking with current profiles', async () => {
    const closed = (await service.close(id.toHexString(), userId)).closed;
    editions.findById.mockReturnValue(
      query({
        ...edition,
        status: 'closed',
        closedAt: new Date(),
        finalRanking: closed.finalRanking,
      }),
    );
    snapshots.withProfiles.mockResolvedValue({
      ...closed.finalRanking,
      entries: closed.finalRanking.entries.map((entry) => ({
        ...entry,
        name: 'Nombre actual',
        avatar: 'current.jpg',
      })),
    });
    editions.findOneAndUpdate.mockReturnValue(query({ awards: closed.awards }));
    const result = await service.winners(id.toHexString());
    expect(result.awards.gold[0]).toMatchObject({
      id: userId.toHexString(),
      name: 'Nombre actual',
      avatar: 'current.jpg',
      points: 9,
    });
    expect(result.awards.goldenUnderpants).toEqual(result.awards.gold);
  });

  it('saves generated awards with the final ranking in the closure transaction', async () => {
    const result = await service.close(id.toHexString(), userId);
    expect(result.closed.awards.gold[0].id).toBe(userId.toHexString());
    expect(editions.updateOne).toHaveBeenCalledWith(
      { _id: id },
      {
        $set: {
          finalRanking: result.closed.finalRanking,
          awards: result.closed.awards,
        },
      },
      { session },
    );
  });

  it('rejects a repeated closure without creating another edition', async () => {
    editions.findOneAndUpdate.mockReturnValue(query(null));
    await expect(service.close(id.toHexString(), userId)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(editions.create).not.toHaveBeenCalled();
  });

  it('assigns the active edition inside the event creation transaction', async () => {
    editions.findOneAndUpdate.mockReturnValue(query(edition));
    events.create.mockResolvedValue([
      { _id: eventId, editionId: id, status: EventStatus.OPEN },
    ]);
    await service.createEvent({
      name: 'Christmas meal',
      status: EventStatus.OPEN,
    });
    expect(editions.findOneAndUpdate).toHaveBeenCalledWith(
      { status: 'open', opensAt: { $lte: new Date() } },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    expect(events.create).toHaveBeenCalledWith(
      [{ name: 'Christmas meal', status: EventStatus.OPEN, editionId: id }],
      { session },
    );
  });

  it('does not allow events during the scheduled minute', async () => {
    editions.findOneAndUpdate.mockReturnValue(query(null));
    await expect(
      service.createEvent({ name: 'Too soon' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(events.create).not.toHaveBeenCalled();
  });

  it('enforces a single open edition using a partial unique database index', () => {
    expect(EditionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { status: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'open' },
          }),
        ],
      ]),
    );
  });

  it('keeps December 31 as guidance without an automatic closing scheduler', async () => {
    jest.setSystemTime(new Date('2027-01-02'));
    editions.exists.mockReturnValue(query({ _id: id }));
    await service.onModuleInit();
    expect(editions.create).not.toHaveBeenCalled();
    expect(editions.updateOne).not.toHaveBeenCalled();
  });
});
