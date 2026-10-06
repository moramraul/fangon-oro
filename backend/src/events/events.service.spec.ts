import { EditionsService } from '../editions/editions.service';
import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from './events.service';
import { Event, EventStatus } from './schemas/event.schema';
import { Vote } from '../votes/schemas/vote.schema';

describe('EventsService permissions and state rules', () => {
  const userId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const user = { _id: userId, role: 'USER' } as UserDocument;
  const event = {
    _id: eventId,
    name: 'Albacete',
    startDate: new Date('2099-10-01T12:00:00Z'),
    endDate: new Date('2099-10-02T12:00:00Z'),
    status: EventStatus.OPEN,
    createdBy: new Types.ObjectId(),
    participants: [userId],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const model = {
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const users = { findSummariesByIds: jest.fn() };
  const notifications = { eventIncluded: jest.fn() };
  const votes = { distinct: jest.fn(), collection: { name: 'votes' } };
  const snapshots = {
    initialize: jest.fn(),
    reconcile: jest.fn(),
    capture: jest.fn(),
  };
  let service: EventsService;

  beforeEach(() => {
    jest.resetAllMocks();
    model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    votes.distinct.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    model.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    users.findSummariesByIds.mockResolvedValue([
      { id: userId.toHexString(), name: 'Davo' },
    ]);
    service = new EventsService(
      model as unknown as Model<Event>,
      users as unknown as UsersService,
      notifications as unknown as NotificationsService,
      votes as unknown as Model<Vote>,
      snapshots as unknown as RankingSnapshotsService,
      {
        createEvent: (data: unknown) => model.create(data) as Promise<unknown>,
      } as unknown as EditionsService,
    );
  });

  it('hides events from nonparticipants', async () => {
    await expect(
      service.getDetail(eventId.toHexString(), {
        _id: new Types.ObjectId(),
        role: 'USER',
      } as UserDocument),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows another ADMIN to manage the detail without participation', async () => {
    const result = await service.getDetail(eventId.toHexString(), {
      _id: new Types.ObjectId(),
      role: 'ADMIN',
    } as UserDocument);
    expect(result.participants).toEqual([
      { id: userId.toHexString(), name: 'Davo' },
    ]);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('filters personal listings by participation even for ADMIN', async () => {
    const exec = jest.fn().mockResolvedValue([event]);
    model.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ exec }) });
    await service.listMine({ ...user, role: 'ADMIN' } as UserDocument);
    expect(model.find).toHaveBeenCalledWith({ participants: userId });
  });

  it('repairs open events with ballots from every participant before listing them', async () => {
    model.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: eventId }]),
    });
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ ...event, status: EventStatus.CLOSED }]),
      }),
    });
    const result = await service.listMine(user);
    expect(model.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            status: EventStatus.OPEN,
            startDate: { $lte: expect.any(Date) as Date },
            'participants.0': { $exists: true },
          },
        },
        {
          $match: {
            $expr: { $setIsSubset: ['$participants', '$ballots.voterId'] },
          },
        },
      ]),
    );
    expect(model.updateMany).toHaveBeenLastCalledWith(
      { _id: { $in: [eventId] }, status: EventStatus.OPEN },
      { $set: { status: EventStatus.CLOSED } },
    );
    expect(result[0].status).toBe('closed');
  });

  it('keeps events open when participation is incomplete', async () => {
    await service.closeExpired();
    expect(model.updateMany).toHaveBeenCalledTimes(1);
  });

  it('marks personal events when the current user has already voted', async () => {
    model.find.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([event]) }),
    });
    expect((await service.listMine(user))[0].hasVoted).toBe(false);
    votes.distinct.mockReturnValue({
      exec: jest.fn().mockResolvedValue([eventId]),
    });
    expect((await service.listMine(user))[0].hasVoted).toBe(true);
    expect(votes.distinct).toHaveBeenCalledWith('eventId', { voterId: userId });
  });

  it('lists legacy events alongside current events without missing-date errors', async () => {
    const legacy = {
      ...event,
      date: event.startDate,
      startDate: undefined,
      endDate: undefined,
      status: 'DRAFT',
    };
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([legacy, event]),
      }),
    });
    const result = await service.listMine(user);
    expect(result[0]).toMatchObject({
      startDate: event.startDate.toISOString(),
      endDate: null,
      status: 'draft',
    });
    expect(result[1]).toMatchObject({
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: 'open',
    });
  });

  it('rejects unknown participants before saving', async () => {
    users.findSummariesByIds.mockResolvedValue([]);
    await expect(
      service.create(
        {
          name: 'Test',
          image: 'data:image/jpeg;base64,/9j/2Q==',
          startDate: '2099-10-01T12:00:00Z',
          endDate: '2099-10-02T12:00:00Z',
          participantIds: [userId.toHexString()],
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate participants before saving', async () => {
    await expect(
      service.setParticipants(eventId.toHexString(), [
        userId.toHexString(),
        userId.toHexString(),
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('requires a future start atomically when editing participants', async () => {
    users.findSummariesByIds.mockResolvedValue([]);
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.setParticipants(eventId.toHexString(), []),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: eventId.toHexString(),
        status: EventStatus.OPEN,
        startDate: { $gt: expect.any(Date) as Date },
        participants: [userId],
      },
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not reopen closed events', async () => {
    model.findById.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...event, status: EventStatus.CLOSED }),
    });
    await expect(
      service.setStatus(eventId.toHexString(), EventStatus.OPEN),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects an end date before the start', async () => {
    await expect(
      service.update(eventId.toHexString(), {
        endDate: '2099-09-01T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('saves a snapshot after a manual closure', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...event, status: EventStatus.CLOSED }),
    });
    await service.setStatus(eventId.toHexString(), EventStatus.CLOSED);
    expect(snapshots.capture).toHaveBeenCalledWith(eventId.toHexString());
  });

  it('recovers missing snapshots after automatic closures', async () => {
    await service.closeExpired();
    expect(snapshots.reconcile).toHaveBeenCalled();
  });

  it('closes expired open events', async () => {
    await service.closeExpired();
    expect(model.updateMany).toHaveBeenCalledWith(
      { status: EventStatus.OPEN, endDate: { $lte: expect.any(Date) as Date } },
      { $set: { status: EventStatus.CLOSED } },
    );
  });
  it('allows manual closure', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ ...event, status: EventStatus.CLOSED }),
    });
    expect(
      (await service.setStatus(eventId.toHexString(), EventStatus.CLOSED))
        .status,
    ).toBe(EventStatus.CLOSED);
  });
  it('notifies participants after creating the event', async () => {
    model.create.mockResolvedValue(event);
    await service.create(
      {
        name: 'Test',
        image: 'data:image/jpeg;base64,/9j/2Q==',
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        participantIds: [userId.toHexString()],
      },
      user,
    );
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'data:image/jpeg;base64,/9j/2Q==' }),
    );
    expect(notifications.eventIncluded).toHaveBeenCalledWith(event, [userId]);
    expect(model.create.mock.invocationCallOrder[0]).toBeLessThan(
      notifications.eventIncluded.mock.invocationCallOrder[0],
    );
  });
  it('notifies only newly added participants', async () => {
    const newId = new Types.ObjectId();
    users.findSummariesByIds.mockResolvedValue([
      { id: userId.toHexString(), name: 'Old' },
      { id: newId.toHexString(), name: 'New' },
    ]);
    const updated = { ...event, participants: [userId, newId] };
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });
    await service.setParticipants(eventId.toHexString(), [
      userId.toHexString(),
      newId.toHexString(),
    ]);
    expect(notifications.eventIncluded).toHaveBeenCalledWith(updated, [newId]);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ participants: event.participants }),
      expect.anything(),
      expect.anything(),
    );
  });
  it('does not notify existing participants again', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    await service.setParticipants(eventId.toHexString(), [
      userId.toHexString(),
    ]);
    expect(notifications.eventIncluded).toHaveBeenCalledWith(event, []);
  });
  it('does not notify when the participant update conflicts', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.setParticipants(eventId.toHexString(), [userId.toHexString()]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.eventIncluded).not.toHaveBeenCalled();
  });
  it('does not notify when saving the event fails', async () => {
    model.create.mockRejectedValue(new Error('Database unavailable'));
    await expect(
      service.create(
        {
          name: 'Test',
          image: 'data:image/jpeg;base64,/9j/2Q==',
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          participantIds: [userId.toHexString()],
        },
        user,
      ),
    ).rejects.toThrow('Database unavailable');
    expect(notifications.eventIncluded).not.toHaveBeenCalled();
  });
});
