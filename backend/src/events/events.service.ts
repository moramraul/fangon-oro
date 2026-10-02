import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { Event, EventDocument, EventStatus } from './schemas/event.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    private readonly usersService: UsersService,
  ) {}

  async listMine(user: UserDocument) {
    const events = await this.eventModel
      .find({ participants: user._id })
      .sort({ date: -1 })
      .exec();
    return events.map((event) => this.summary(event));
  }

  async listAll() {
    const events = await this.eventModel.find().sort({ date: -1 }).exec();
    return events.map((event) => this.summary(event));
  }

  async getDetail(id: string, user: UserDocument) {
    const event = await this.findEvent(id);
    if (
      user.role !== 'ADMIN' &&
      !event.participants.some((participant) => participant.equals(user._id))
    ) {
      throw new NotFoundException('Event not found');
    }
    return this.detail(event);
  }

  async create(dto: CreateEventDto, user: UserDocument) {
    const participants = await this.validateParticipants(
      dto.participantIds ?? [],
    );
    const event = await this.eventModel.create({
      name: dto.name,
      date: new Date(dto.date),
      description: dto.description,
      participants,
      createdBy: user._id,
      status: EventStatus.DRAFT,
    });
    return this.detail(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    this.validateId(id);
    const changes: { name?: string; date?: Date; description?: string } = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.date !== undefined) changes.date = new Date(dto.date);
    if (dto.description !== undefined) changes.description = dto.description;
    if (!Object.keys(changes).length)
      throw new BadRequestException('No fields to update');
    const event = await this.eventModel
      .findByIdAndUpdate(
        id,
        { $set: changes },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event) throw new NotFoundException('Event not found');
    return this.detail(event);
  }

  async setParticipants(id: string, participantIds: string[]) {
    await this.findEvent(id);
    const participants = await this.validateParticipants(participantIds);
    const event = await this.eventModel
      .findOneAndUpdate(
        { _id: id, status: EventStatus.DRAFT },
        { $set: { participants } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event)
      throw new ConflictException('Participants can only change in DRAFT');
    return this.detail(event);
  }

  async setStatus(id: string, status: EventStatus) {
    await this.findEvent(id);
    if (status === EventStatus.DRAFT)
      throw new ConflictException('Cannot return to DRAFT');
    const previousStatus =
      status === EventStatus.OPEN ? EventStatus.DRAFT : EventStatus.OPEN;
    const event = await this.eventModel
      .findOneAndUpdate(
        {
          _id: id,
          status: previousStatus,
          ...(status === EventStatus.OPEN
            ? { 'participants.0': { $exists: true } }
            : {}),
        },
        { $set: { status } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event)
      throw new ConflictException(
        'Invalid transition or event has no participants',
      );
    return this.detail(event);
  }

  async remove(id: string) {
    await this.findEvent(id);
    const event = await this.eventModel
      .findOneAndDelete({ _id: id, status: EventStatus.DRAFT })
      .exec();
    if (!event) throw new ConflictException('Only DRAFT events can be deleted');
  }

  private validateId(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid event ID');
  }

  private async findEvent(id: string) {
    this.validateId(id);
    const event = await this.eventModel.findById(id).exec();
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async validateParticipants(ids: string[]) {
    if (ids.some((id) => !Types.ObjectId.isValid(id)))
      throw new BadRequestException('Invalid participant ID');
    const participants = ids.map((id) => new Types.ObjectId(id));
    if (
      new Set(participants.map((id) => id.toHexString())).size !== ids.length
    ) {
      throw new BadRequestException('Duplicate participants');
    }
    const users = await this.usersService.findSummariesByIds(participants);
    if (users.length !== ids.length)
      throw new BadRequestException(
        'All participants must be registered users',
      );
    return participants;
  }

  private summary(event: EventDocument) {
    return {
      id: event._id.toHexString(),
      name: event.name,
      date: event.date.toISOString(),
      status: event.status,
      participantCount: event.participants.length,
    };
  }

  private async detail(event: EventDocument) {
    const participants = await this.usersService.findSummariesByIds(
      event.participants,
    );
    return {
      ...this.summary(event),
      description: event.description ?? null,
      createdBy: event.createdBy.toHexString(),
      participants,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
