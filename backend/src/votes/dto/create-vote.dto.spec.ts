import { ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateVoteDto } from './create-vote.dto';

describe('Vote input validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateVoteDto });

  it('rejects client-supplied voter identity', async () => {
    await expect(
      validate({
        votedUserId: new Types.ObjectId().toHexString(),
        voterId: new Types.ObjectId().toHexString(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([{}, { votedUserId: null }, { votedUserId: 'invalid' }])(
    'rejects invalid candidates %p',
    async (body) => {
      await expect(validate(body)).rejects.toMatchObject({ status: 400 });
    },
  );
});
