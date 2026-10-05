import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  const check = (value: Record<string, unknown>) =>
    validate(plainToInstance(UpdateProfileDto, value), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('trims the name and allows keeping or removing the photo', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '  Ana  ' });
    expect(dto.name).toBe('Ana');
    expect(await validate(dto)).toHaveLength(0);
    expect(await check({ name: 'Ana', avatar: '' })).toHaveLength(0);
    expect(
      await check({ name: 'Ana', avatar: 'data:image/jpeg;base64,/9j/AA==' }),
    ).toHaveLength(0);
  });

  it.each([
    { name: '   ' },
    { name: 'a'.repeat(81) },
    { name: 'Ana', avatar: null },
    { name: 'Ana', avatar: 'https://example.com/photo.jpg' },
    { name: 'Ana', avatar: 'data:image/svg+xml;base64,AAAA' },
    { name: 'Ana', avatar: 'data:image/jpeg;base64,' + 'A'.repeat(90000) },
    { name: 'Ana', role: 'ADMIN' },
    { name: 'Ana', id: 'another-user' },
  ])('rejects invalid or unauthorized profile fields: %j', async (value) => {
    expect((await check(value)).length).toBeGreaterThan(0);
  });
});
