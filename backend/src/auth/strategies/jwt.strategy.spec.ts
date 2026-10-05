import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JWT account activation', () => {
  const users = { findById: jest.fn() };
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: 'test-secret' }),
    users as unknown as UsersService,
  );
  const payload = {
    sub: 'user-id',
    email: 'ana@example.com',
    role: 'USER' as const,
  };

  it.each([null, { isActive: false }, {}])(
    'rejects unavailable or inactive accounts: %p',
    async (user) => {
      users.findById.mockResolvedValue(user);
      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    },
  );

  it('accepts an active account', async () => {
    const user = { isActive: true };
    users.findById.mockResolvedValue(user);
    await expect(strategy.validate(payload)).resolves.toBe(user);
  });
});
