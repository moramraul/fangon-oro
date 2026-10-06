import { EditionsService } from '../editions/editions.service';
import { Types } from 'mongoose';
import { BadRequestException, Injectable } from '@nestjs/common';
import { RankingEntry } from './models/ranking.model';
import { RankingSnapshotsService } from './snapshots/ranking-snapshots.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly snapshots: RankingSnapshotsService,
    private readonly editions: EditionsService,
  ) {}

  async get(selection?: string) {
    if (
      selection !== undefined &&
      (typeof selection !== 'string' ||
        (selection !== 'global' && !Types.ObjectId.isValid(selection)))
    )
      throw new BadRequestException('Select an edition ID or global');
    const snapshot = await this.snapshots.latest();
    const scope = selection === 'global' ? 'global' : 'edition';
    const edition =
      scope === 'global'
        ? null
        : selection
          ? await this.editions.find(selection)
          : await this.editions.current();
    const editionId = edition?._id.toHexString() ?? null;
    const entries: (RankingEntry & { avatar?: string | null })[] =
      scope === 'global'
        ? (snapshot?.generalRanking?.entries ?? [])
        : edition?.status === 'closed'
          ? (edition.finalRanking?.entries ?? [])
          : editionId
            ? (snapshot?.editions?.[editionId] ?? [])
            : [];
    const people = entries.map((entry) => {
      const ones =
        entry.points - 5 * entry.fivePointVotes - 3 * entry.threePointVotes;
      return {
        id: entry.id,
        name: entry.name,
        avatar: entry.avatar ?? null,
        fives: entry.fivePointVotes,
        threes: entry.threePointVotes,
        ones,
        received: entry.fivePointVotes + entry.threePointVotes + ones,
      };
    });
    const definitions = [
      {
        id: 'mister-five',
        title: 'Mister 5',
        description: 'Líder en actuaciones legendarias',
        field: 'fives',
        minimum: false,
      },
      {
        id: 'mister-three',
        title: 'Mister 3',
        description: 'El guarro en la sombra',
        field: 'threes',
        minimum: false,
      },
      {
        id: 'mister-one',
        title: 'Mister 1',
        description: 'Siempre deja un detalle',
        field: 'ones',
        minimum: false,
      },
      {
        id: 'anti-fangon',
        title: 'El anti fangón',
        description: "Ganador de la Calzon's",
        field: 'received',
        minimum: true,
      },
    ] as const;
    return {
      scope,
      editionId,
      editionName: edition?.name ?? null,
      editions: await this.editions.list(),
      calculatedAt:
        edition?.status === 'closed'
          ? (edition.closedAt?.toISOString() ?? null)
          : scope === 'global' || (editionId && snapshot?.editions?.[editionId])
            ? (snapshot?.calculatedAt?.toISOString() ?? null)
            : null,
      awards: !people.length
        ? []
        : definitions.map(({ id, title, description, field, minimum }) => {
            const counts = people.map((person) => person[field]);
            const votes = minimum ? Math.min(...counts) : Math.max(...counts);
            const winners =
              !minimum && votes === 0
                ? []
                : people.filter((person) => person[field] === votes);
            return {
              id,
              title,
              description,
              votes,
              people: winners.map(({ id, name, avatar }) => ({
                id,
                name,
                avatar,
              })),
            };
          }),
    };
  }
}
