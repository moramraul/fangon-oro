import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordRecoveryService } from './password-recovery.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/schemas/user.schema';

describe('Password recovery', () => {
  const users = { findOneAndUpdate: jest.fn() };
  const notifications = { passwordRecovery: jest.fn() };
  const service = new PasswordRecoveryService(
    users as unknown as Model<User>,
    notifications as unknown as NotificationsService,
    new ConfigService({
      MAIL_ENABLED: 'true',
      FRONTEND_URL: 'https://fangon.example/',
    }),
  );
  beforeEach(() => {
    jest.clearAllMocks();
    users.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
  });

  it('returns the same response for unknown and eligible accounts without exposing the token', async () => {
    const unknown = await service.forgot('unknown@example.com');
    expect(notifications.passwordRecovery).not.toHaveBeenCalled();
    users.findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ name: '<Ana>', email: 'ana@example.com' }),
    });
    expect(await service.forgot('ANA@example.com')).toEqual(unknown);
    const url = notifications.passwordRecovery.mock.calls[0][1] as string;
    const token = new URLSearchParams(new URL(url).hash.split('?')[1]).get(
      'token',
    )!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const [filter, update] = users.findOneAndUpdate.mock.calls[1];
    expect(filter).toMatchObject({
      email: 'ana@example.com',
      isActive: true,
      passwordHash: { $type: 'string', $ne: '' },
    });
    expect(update.$set.passwordResetTokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(
      update.$set.passwordResetExpiresAt.getTime() -
        update.$set.passwordResetRequestedAt.getTime(),
    ).toBe(1800000);
    expect(filter.$or[1].passwordResetRequestedAt.$lte.getTime()).toBe(
      update.$set.passwordResetRequestedAt.getTime() - 60000,
    );
  });

  it('consumes the token atomically, hashes the password and invalidates prior sessions', async () => {
    users.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({}),
    });
    const token = 'a'.repeat(64);
    await service.reset(token, 'new-password');
    const [filter, update] = users.findOneAndUpdate.mock.calls[0];
    expect(filter.passwordResetTokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(filter.passwordResetExpiresAt.$gt).toBeInstanceOf(Date);
    expect(filter.isActive).toBe(true);
    expect(await bcrypt.compare('new-password', update.$set.passwordHash)).toBe(
      true,
    );
    expect(update.$unset).toEqual({
      passwordResetTokenHash: 1,
      passwordResetExpiresAt: 1,
    });
    expect(update.$inc).toEqual({ sessionVersion: 1 });
    await expect(service.reset(token, 'another-password')).rejects.toThrow(
      'El enlace no es válido',
    );
  });

  it('rejects expired tokens and oversized multibyte passwords', async () => {
    await expect(service.reset('b'.repeat(64), 'new-password')).rejects.toThrow(
      'El enlace no es válido',
    );
    users.findOneAndUpdate.mockClear();
    await expect(
      service.reset('b'.repeat(64), '😀'.repeat(30)),
    ).rejects.toThrow('72 bytes');
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
