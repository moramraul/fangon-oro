import { UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import { UsersService } from './users.service';
import { UserDocument } from './schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

describe('Google account linking', () => {
  const model = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  };
  const service = new UsersService(
    model as unknown as Model<UserDocument>,
    { accountActivated: jest.fn() } as unknown as NotificationsService,
  );
  const identity = {
    googleId: 'google-123',
    email: 'ana@gmail.com',
    name: 'Ana',
    authoritativeEmail: true,
  };
  const query = (value: unknown) => ({
    exec: jest.fn().mockResolvedValue(value),
  });
  beforeEach(() => jest.resetAllMocks());

  it('uses the linked Google subject even if the email changes', async () => {
    const linked = { googleId: identity.googleId, email: 'old@gmail.com' };
    model.findOne.mockReturnValue(query(linked));
    await expect(service.findOrCreateGoogleUser(identity)).resolves.toEqual(
      linked,
    );
    expect(model.findOne).toHaveBeenCalledTimes(1);
  });

  it('creates new accounts pending activation without a password or admin role', async () => {
    model.findOne.mockReturnValue(query(null));
    model.create.mockResolvedValue({ ...identity, isActive: false });
    await service.findOrCreateGoogleUser(identity);
    expect(model.create).toHaveBeenCalledWith({
      googleId: identity.googleId,
      email: identity.email,
      name: identity.name,
      isActive: false,
    });
  });

  it('refuses to link an existing third-party email', async () => {
    model.findOne
      .mockReturnValueOnce(query(null))
      .mockReturnValueOnce(query({ _id: 'id' }));
    await expect(
      service.findOrCreateGoogleUser({
        ...identity,
        authoritativeEmail: false,
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('only adds the Google subject when linking an existing account', async () => {
    const existing = {
      _id: 'id',
      isActive: false,
      role: 'ADMIN',
      passwordHash: 'hash',
    };
    model.findOne
      .mockReturnValueOnce(query(null))
      .mockReturnValueOnce(query(existing));
    model.findOneAndUpdate.mockReturnValue(
      query({ ...existing, googleId: identity.googleId }),
    );
    await service.findOrCreateGoogleUser(identity);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'id', googleId: { $exists: false } },
      { $set: { googleId: identity.googleId } },
      { new: true, runValidators: true },
    );
  });
});
