import { ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { CreatePasswordDto } from '../auth/dto/create-password.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('Creating a password for a Google account', () => {
  const model = {
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    exists: jest.fn(),
  };
  const service = new UsersService(
    model as unknown as Model<UserDocument>,
    { accountActivated: jest.fn() } as unknown as NotificationsService,
  );
  beforeEach(() => jest.resetAllMocks());

  it('hashes the password and only updates active Google accounts with no password', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'user' }),
    });
    await service.createPassword('user', 'password123');
    const [filter, update] = model.findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: { passwordHash: string; passwordPromptSeen: boolean } },
    ];
    expect(filter).toEqual({
      _id: 'user',
      isActive: true,
      googleId: { $type: 'string' },
      $or: [
        { passwordHash: { $exists: false } },
        { passwordHash: null },
        { passwordHash: '' },
      ],
    });
    expect(update.$set.passwordPromptSeen).toBe(true);
    expect(update.$set.passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', update.$set.passwordHash)).toBe(
      true,
    );
    expect(Object.keys(update.$set).sort()).toEqual([
      'passwordHash',
      'passwordPromptSeen',
    ]);
  });

  it('does not overwrite an existing password or modify an ineligible account', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(service.createPassword('user', 'password123')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects multibyte passwords exceeding the bcrypt limit', async () => {
    await expect(
      service.createPassword('user', '😀'.repeat(20)),
    ).rejects.toThrow(ConflictException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('persists the prompt decision for the authenticated user', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ passwordPromptSeen: true }),
    });
    await service.acknowledgePasswordPrompt('user');
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'user',
      { $set: { passwordPromptSeen: true } },
      { new: true },
    );
  });

  it.each(['short', '', 123, null, 'a'.repeat(73)])(
    'rejects an invalid password: %p',
    async (password) => {
      const dto = Object.assign(new CreatePasswordDto(), { password });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
});
