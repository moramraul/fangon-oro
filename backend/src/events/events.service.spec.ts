import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { EventsService } from './events.service';
import { Event, EventStatus } from './schemas/event.schema';

describe('EventsService permissions and state rules', () => {
  const userId = new Types.ObjectId();
  const eventId = new Types.ObjectId();
  const user = { _id: userId, role: 'USER' } as UserDocument;
  const event = {
    _id: eventId,
    name: 'Albacete',
    date: new Date('2026-10-01T12:00:00Z'),
    status: EventStatus.DRAFT,
    createdBy: new Types.ObjectId(),
    participants: [userId],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const model = {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const users = { findSummariesByIds: jest.fn() };
  let service: EventsService;

  beforeEach(() => {
    jest.resetAllMocks();
    model.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(event),
    });
    users.findSummariesByIds.mockResolvedValue([
      { id: userId.toHexString(), name: 'Davo' },
    ]);
    service = new EventsService(
      model as unknown as Model<Event>,
      users as unknown as UsersService,
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

  it('rejects unknown participants before saving', async () => {
    users.findSummariesByIds.mockResolvedValue([]);
    await expect(
      service.create(
        {
          name: 'Test',
          date: '2026-10-01T12:00:00Z',
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

  it('requires DRAFT atomically when editing participants', async () => {
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
        status: EventStatus.DRAFT,
      },
      expect.anything(),
      expect.anything(),
    );
  });

  it('requires a participant and DRAFT atomically when opening', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.setStatus(eventId.toHexString(), EventStatus.OPEN),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: eventId.toHexString(),
        status: EventStatus.DRAFT,
        'participants.0': { $exists: true },
      },
      expect.anything(),
      expect.anything(),
    );
  });
});
