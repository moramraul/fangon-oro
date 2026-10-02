import { ValidationPipe } from '@nestjs/common';
import { CreateEventDto, SetParticipantsDto } from './event.dto';

describe('Event input validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validateCreate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateEventDto });

  it.each(['open', 'closed'])(
    'accepts %s status with both dates',
    async (status) => {
      await expect(
        validateCreate({
          name: 'Test',
          startDate: '2026-10-01T12:00:00Z',
          endDate: '2026-10-02T12:00:00Z',
          status,
        }),
      ).resolves.toMatchObject({ status });
    },
  );

  it('rejects draft status', async () => {
    await expect(
      validateCreate({
        name: 'Test',
        startDate: '2026-10-01T12:00:00Z',
        endDate: '2026-10-02T12:00:00Z',
        status: 'DRAFT',
      }),
    ).rejects.toThrow();
  });

  it('rejects client supplied ownership', async () => {
    await expect(
      validateCreate({
        name: 'Test',
        startDate: '2026-10-01T12:00:00Z',
        endDate: '2026-10-02T12:00:00Z',
        createdBy: 'someone',
      }),
    ).rejects.toThrow();
  });

  it('rejects dates without a time zone', async () => {
    await expect(
      validateCreate({
        name: 'Test',
        startDate: '2026-10-01T12:00:00',
        endDate: '2026-10-02T12:00:00Z',
      }),
    ).rejects.toThrow();
  });

  it('rejects non-string participant IDs with a validation error', async () => {
    await expect(
      pipe.transform(
        { participantIds: [123] },
        { type: 'body', metatype: SetParticipantsDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects null participants instead of silently dropping them', async () => {
    await expect(
      validateCreate({
        name: 'Test',
        startDate: '2026-10-01T12:00:00Z',
        endDate: '2026-10-02T12:00:00Z',
        participantIds: null,
      }),
    ).rejects.toThrow();
  });
});
