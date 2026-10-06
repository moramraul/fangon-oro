import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Edition } from './edition.schema';
import { Event, EventStatus } from '../events/schemas/event.schema';
import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { Ranking } from '../rankings/models/ranking.model';
import { editionYear } from '../votes/edition';

@Injectable()
export class EditionsService implements OnModuleInit {
  constructor(
    @InjectModel(Edition.name) private readonly editions: Model<Edition>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectConnection() private readonly connection: Connection,
    private readonly snapshots: RankingSnapshotsService,
  ) {}

  async onModuleInit() {
    await this.editions.init();
    if (await this.editions.exists({ status: 'open' }).exec()) return;
    const last = await this.editions.findOne().sort({ number: -1 }).exec();
    const now = new Date();
    const number = Math.max(editionYear(now), (last?.number ?? 0) + 1);
    try {
      await this.editions.create(this.newEdition(number, now));
    } catch (error: unknown) {
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000 &&
        (await this.editions.exists({ status: 'open' }).exec())
      ))
        throw error;
    }
  }

  private newEdition(number: number, opensAt: Date) {
    return {
      name: `Fangón de Oro ${number}`,
      number,
      status: 'open' as const,
      opensAt,
      expectedEndsAt: new Date(`${number}-12-31T23:59:59.999+01:00`),
    };
  }

  async current() {
    const edition = await this.editions.findOne({ status: 'open' }).exec();
    if (!edition) throw new ConflictException('No hay una edición abierta');
    return edition;
  }

  async find(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid edition ID');
    const edition = await this.editions.findById(id).exec();
    if (!edition) throw new NotFoundException('Edition not found');
    return edition;
  }

  async list() {
    return (await this.editions.find().sort({ number: -1 }).exec()).map(
      (edition) => this.summary(edition),
    );
  }

  summary(edition: Edition & { _id: Types.ObjectId }) {
    return {
      id: edition._id.toHexString(),
      name: edition.name,
      number: edition.number,
      status: edition.status,
      opensAt: edition.opensAt.toISOString(),
      expectedEndsAt: edition.expectedEndsAt.toISOString(),
      closedAt: edition.closedAt?.toISOString() ?? null,
    };
  }

  async createEvent(data: Omit<Partial<Event>, 'editionId'>) {
    return this.connection.transaction(async (session) => {
      // Event creation and edition closure write the same document, so a
      // concurrent creation can never slip into a finalized edition.
      const edition = await this.editions
        .findOneAndUpdate(
          { status: 'open', opensAt: { $lte: new Date() } },
          { $inc: { revision: 1 } },
          { session, new: true },
        )
        .exec();
      if (!edition)
        throw new ConflictException(
          'La nueva edición todavía no ha comenzado. Espera a su hora de apertura.',
        );
      const [event] = await this.events.create(
        [{ ...data, editionId: edition._id }],
        { session },
      );
      if (event.status === EventStatus.CLOSED)
        await this.snapshots.capture(event._id.toHexString(), session);
      return event;
    });
  }

  async close(id: string, closedBy: Types.ObjectId) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid edition ID');
    await this.snapshots.initialize();
    return this.connection.transaction(async (session) => {
      const now = new Date();
      const edition = await this.editions
        .findOneAndUpdate(
          { _id: id, status: 'open', opensAt: { $lte: now } },
          {
            $set: { status: 'closed', closedAt: now, closedBy },
            $inc: { revision: 1 },
          },
          { session, new: true },
        )
        .exec();
      if (!edition)
        throw new ConflictException(
          'La edición ya está cerrada o todavía no ha comenzado',
        );
      await this.events
        .updateMany(
          {
            editionId: edition._id,
            status: EventStatus.OPEN,
            endDate: { $lte: now },
          },
          { $set: { status: EventStatus.CLOSED } },
          { session },
        )
        .exec();
      if (
        await this.events
          .exists({ editionId: edition._id, status: EventStatus.OPEN })
          .session(session)
          .exec()
      )
        throw new ConflictException(
          'Hay eventos con votaciones pendientes de cierre. Revisa sus fechas antes de cerrar la edición.',
        );
      const closed = await this.events
        .find({ editionId: edition._id, status: EventStatus.CLOSED })
        .session(session)
        .sort({ endDate: 1, _id: 1 })
        .exec();
      for (const event of closed)
        await this.snapshots.capture(event._id.toHexString(), session);
      const snapshot = await this.snapshots.latest(session);
      const entries = snapshot?.editions?.[edition._id.toHexString()] ?? [];
      const finalRanking = Ranking.from(
        entries,
        entries.reduce((sum, entry) => sum + entry.points, 0),
      );
      await this.editions
        .updateOne(
          { _id: edition._id },
          { $set: { finalRanking } },
          { session },
        )
        .exec();
      const opensAt = new Date(now.getTime() + 60000);
      const nextNumber = Math.max(edition.number + 1, editionYear(opensAt));
      const [next] = await this.editions.create(
        [this.newEdition(nextNumber, opensAt)],
        { session },
      );
      return {
        closed: { ...this.summary(edition), finalRanking },
        opened: this.summary(next),
      };
    });
  }
}
