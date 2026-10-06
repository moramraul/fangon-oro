import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { EditionsService } from '../editions/editions.service';
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
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { Vote } from '../votes/schemas/vote.schema';
import {
  Event,
  EventDocument,
  EventStatus,
  EventSummaryStatus,
} from './schemas/event.schema';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(EventsService.name);

  async onModuleInit() {
    await this.snapshots.initialize();
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
    const completed = await this.eventModel
      .aggregate<{ _id: Types.ObjectId }>([
        {
          $match: {
            status: EventStatus.OPEN,
            startDate: { $lte: new Date() },
            'participants.0': { $exists: true },
          },
        },
        {
          $lookup: {
            from: this.voteModel.collection.name,
            localField: '_id',
            foreignField: 'eventId',
            pipeline: [{ $project: { _id: 0, voterId: 1 } }],
            as: 'ballots',
          },
        },
        {
          $match: {
            $expr: { $setIsSubset: ['$participants', '$ballots.voterId'] },
          },
        },
        { $project: { _id: 1 } },
      ])
      .exec();
    if (completed.length) {
      // Participants cannot change after the event starts, and votes are immutable.
      await this.eventModel
        .updateMany(
          {
            _id: { $in: completed.map((event) => event._id) },
            status: EventStatus.OPEN,
          },
          { $set: { status: EventStatus.CLOSED } },
        )
        .exec();
    }
    await this.snapshots.reconcile();
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
    private readonly notificationsService: NotificationsService,
    @InjectModel(Vote.name) private readonly voteModel: Model<Vote>,
    private readonly snapshots: RankingSnapshotsService,
    private readonly editions: EditionsService,
  ) {}

  async listMine(user: UserDocument) {
    await this.closeExpired();
    const events = await this.eventModel
      .find({ participants: user._id })
      .sort({ startDate: -1 })
      .exec();
    const votedEventIds = new Set(
      (
        await this.voteModel.distinct('eventId', { voterId: user._id }).exec()
      ).map((id: Types.ObjectId) => id.toHexString()),
    );
    return events.map((event) => ({
      ...this.summary(event),
      hasVoted: votedEventIds.has(event._id.toHexString()),
    }));
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
    const event = await this.editions.createEvent({
      name: dto.name,
      image: dto.image,
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
    await this.notificationsService.eventIncluded(event, participants);
    return this.detail(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    const current = await this.findEvent(id);
    const changes: {
      name?: string;
      image?: string;
      startDate?: Date;
      endDate?: Date;
      description?: string;
      status?: EventStatus;
    } = {};
    if (dto.image !== undefined) changes.image = dto.image;
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
    if (event.status === EventStatus.CLOSED) await this.snapshots.capture(id);
    return this.detail(event);
  }

  async setParticipants(id: string, participantIds: string[]) {
    const current = await this.findEvent(id);
    const participants = await this.validateParticipants(participantIds);
    const event = await this.eventModel
      .findOneAndUpdate(
        {
          _id: id,
          status: EventStatus.OPEN,
          startDate: { $gt: new Date() },
          participants: current.participants,
        },
        { $set: { participants } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!event)
      throw new ConflictException(
        'Participants can only change before voting starts; if the event changed, retry',
      );
    const added = participants.filter(
      (id) => !current.participants.some((existing) => existing.equals(id)),
    );
    await this.notificationsService.eventIncluded(event, added);
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
    if (event.status === EventStatus.CLOSED) await this.snapshots.capture(id);
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
    const startDate = event.startDate ?? event.date;
    const storedStatus = String(event.status).toLowerCase();
    const status: EventSummaryStatus =
      storedStatus === 'closed'
        ? EventStatus.CLOSED
        : storedStatus === 'open'
          ? EventStatus.OPEN
          : 'draft';
    return {
      id: event._id.toHexString(),
      editionId: event.editionId?.toHexString() ?? null,
      name: event.name,
      image: event.image ?? null,
      startDate: startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
      status,
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
