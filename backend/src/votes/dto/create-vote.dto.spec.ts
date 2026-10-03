import { ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateVoteDto } from './create-vote.dto';
describe('Vote input validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const ids = Array.from({ length: 3 }, () =>
    new Types.ObjectId().toHexString(),
  );
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateVoteDto });
  it('accepts three ordered candidates', async () => {
    await expect(validate({ candidateIds: ids })).resolves.toMatchObject({
      candidateIds: ids,
    });
  });
  it.each([
    {},
    { candidateIds: null },
    { candidateIds: ids.slice(0, 2) },
    { candidateIds: [...ids, ids[0]] },
    { candidateIds: [ids[0], ids[0].toUpperCase(), ids[2]] },
    { candidateIds: ['invalid', ids[1], ids[2]] },
    { candidateIds: ids, voterId: ids[0] },
    { candidateIds: ids, points: [5, 3, 1] },
  ])('rejects invalid ballots %p', async (body) => {
    await expect(validate(body)).rejects.toMatchObject({ status: 400 });
  });
});
