import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Model, Types, Connection } from 'mongoose';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventsService } from '../events/events.service';
import { Event } from '../events/schemas/event.schema';
import { RankingSnapshotsService } from '../rankings/snapshots/ranking-snapshots.service';
import { Vote } from './schemas/vote.schema';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

describe('Responses HTTP access', () => {
  let app: INestApplication<App>;
  const id = new Types.ObjectId().toHexString();
  const candidateId = new Types.ObjectId();
  const events = { getDetail: jest.fn() };
  const votes = {
    aggregate: jest.fn(),
    init: jest.fn().mockResolvedValue(undefined),
  };
  beforeAll(async () => {
    const service = new VotesService(
      votes as unknown as Model<Vote>,
      {} as Model<Event>,
      {} as Connection,
      events as unknown as EventsService,
      {
        forEvent: jest.fn().mockResolvedValue(null),
      } as unknown as RankingSnapshotsService,
    );
    const module = await Test.createTestingModule({
      controllers: [VotesController],
      providers: [{ provide: VotesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects direct HTTP queries before closure without reading responses', async () => {
    events.getDetail.mockResolvedValue({
      id,
      status: 'open',
      participants: [],
    });
    await request(app.getHttpServer())
      .get(`/events/${id}/responses`)
      .expect(409);
    expect(votes.aggregate).not.toHaveBeenCalled();
  });

  it('serializes an explicit anonymous allowlist after closure', async () => {
    events.getDetail.mockResolvedValue({
      id,
      status: 'closed',
      participants: [{ id: candidateId.toHexString(), name: 'Ana' }],
    });
    votes.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          candidateId,
          points: 5,
          justification: 'Una gran actuaciÃ³n',
          voterId: new Types.ObjectId(),
          _id: new Types.ObjectId(),
          email: 'private@example.com',
          name: 'Author',
          createdAt: new Date(),
        },
      ]),
    });
    const response = await request(app.getHttpServer())
      .get(`/events/${id}/responses`)
      .expect(200);
    expect(response.body).toEqual([
      {
        participantName: 'Ana',
        points: 5,
        justification: 'Una gran actuaciÃ³n',
      },
    ]);
  });
});
