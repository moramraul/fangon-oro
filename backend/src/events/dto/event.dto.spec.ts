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

  it('rejects client supplied ownership', async () => {
    await expect(
      validateCreate({
        name: 'Test',
        date: '2026-10-01T12:00:00Z',
        createdBy: 'someone',
      }),
    ).rejects.toThrow();
  });

  it('rejects dates without a time zone', async () => {
    await expect(
      validateCreate({ name: 'Test', date: '2026-10-01T12:00:00' }),
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
        date: '2026-10-01T12:00:00Z',
        participantIds: null,
      }),
    ).rejects.toThrow();
  });
});
