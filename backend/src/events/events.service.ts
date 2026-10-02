import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { Event, EventDocument, EventStatus } from './schemas/event.schema';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(EventsService.name);

  async onModuleInit() {
    await this.closeExpired();
    this.timer = setInterval(() => {
      void this.closeExpired().catch((error: unknown) =>
        this.logger.error(error),
      );
    }, 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async closeExpired() {
    await this.eventModel
      .updateMany(
        { status: EventStatus.OPEN, endDate: { $lte: new Date() } },
        { $set: { status: EventStatus.CLOSED } },
      )
      .exec();
  }

  private validateDates(startDate: Date, endDate: Date) {
    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime()) ||
      endDate <= startDate
    )
      throw new BadRequestException('endDate must be after startDate');
  }

  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
    private readonly usersService: UsersService,
  ) {}

  async listMine(user: UserDocument) {
    await this.closeExpired();
    const events = await this.eventModel
      .find({ participants: user._id })
      .sort({ startDate: -1 })
      .exec();
    return events.map((event) => this.summary(event));
  }

  async listAll() {
    await this.closeExpired();
    const events = await this.eventModel.find().sort({ startDate: -1 }).exec();
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
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.validateDates(startDate, endDate);
    const participants = await this.validateParticipants(
      dto.participantIds ?? [],
    );
    const event = await this.eventModel.create({
      name: dto.name,
      startDate,
      endDate,
      description: dto.description,
      participants,
      createdBy: user._id,
      status:
        endDate <= new Date()
          ? EventStatus.CLOSED
          : (dto.status ?? EventStatus.OPEN),
    });
    return this.detail(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    const current = await this.findEvent(id);
    const changes: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      description?: string;
      status?: EventStatus;
    } = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.startDate !== undefined) {
      if (
        current.startDate <= new Date() &&
        new Date(dto.startDate).getTime() !== current.startDate.getTime()
      )
        throw new ConflictException(
          'startDate cannot change after voting starts',
        );
      changes.startDate = new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) changes.endDate = new Date(dto.endDate);
    this.validateDates(
      changes.startDate ?? current.startDate,
      changes.endDate ?? current.endDate,
    );
    if (
      dto.status === EventStatus.OPEN &&
      current.status === EventStatus.CLOSED
    )
      throw new ConflictException('Closed events cannot be reopened');
    if (dto.status !== undefined) changes.status = dto.status;
    if ((changes.endDate ?? current.endDate) <= new Date())
      changes.status = EventStatus.CLOSED;
    if (dto.description !== undefined) changes.description = dto.description;
    if (!Object.keys(changes).length)
      throw new BadRequestException('No fields to update');
    const event = await this.eventModel
      .findOneAndUpdate(
        {
          _id: id,
          status: current.status,
          startDate: current.startDate,
          endDate: current.endDate,
        },
        { $set: changes },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event) throw new ConflictException('Event changed; retry the update');
    return this.detail(event);
  }

  async setParticipants(id: string, participantIds: string[]) {
    await this.findEvent(id);
    const participants = await this.validateParticipants(participantIds);
    const event = await this.eventModel
      .findOneAndUpdate(
        { _id: id, status: EventStatus.OPEN, startDate: { $gt: new Date() } },
        { $set: { participants } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event)
      throw new ConflictException(
        'Participants can only change before voting starts',
      );
    return this.detail(event);
  }

  async setStatus(id: string, status: EventStatus) {
    const current = await this.findEvent(id);
    if (status === EventStatus.OPEN && current.status === EventStatus.CLOSED)
      throw new ConflictException('Closed events cannot be reopened');
    const event = await this.eventModel
      .findOneAndUpdate(
        { _id: id, status: current.status },
        { $set: { status } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event) throw new ConflictException('Event changed; retry the update');
    return this.detail(event);
  }

  async remove(id: string) {
    await this.findEvent(id);
    const event = await this.eventModel
      .findOneAndDelete({
        _id: id,
        status: EventStatus.OPEN,
        startDate: { $gt: new Date() },
      })
      .exec();
    if (!event)
      throw new ConflictException(
        'Only events whose voting has not started can be deleted',
      );
  }

  private validateId(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid event ID');
  }

  private async findEvent(id: string) {
    this.validateId(id);
    await this.closeExpired();
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
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
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
