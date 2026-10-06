import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('Activation notifications', () => {
  const user = {
    _id: new Types.ObjectId(),
    name: 'Ana',
    email: 'ana@example.com',
    role: 'USER',
    isActive: false,
  };
  const model = { findByIdAndUpdate: jest.fn() };
  const notifications = { accountActivated: jest.fn() };
  const service = new UsersService(
    model as unknown as Model<UserDocument>,
    notifications as unknown as NotificationsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(user),
    });
    notifications.accountActivated.mockResolvedValue(undefined);
  });

  it('notifies after saving activation and returns the active account', async () => {
    await expect(
      service.updateActivation(user._id.toHexString(), true),
    ).resolves.toMatchObject({ isActive: true, email: user.email });
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      user._id.toHexString(),
      { $set: { isActive: true } },
      { new: false, runValidators: true },
    );
    expect(notifications.accountActivated).toHaveBeenCalledWith(user);
  });

  it('does not notify again when the account is already active', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...user, isActive: true }),
    });
    await service.updateActivation(user._id.toHexString(), true);
    expect(notifications.accountActivated).not.toHaveBeenCalled();
  });

  it('does not notify on deactivation', async () => {
    await service.updateActivation(user._id.toHexString(), false);
    expect(notifications.accountActivated).not.toHaveBeenCalled();
  });

  it('does not notify for a missing account', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.updateActivation(user._id.toHexString(), true),
    ).rejects.toThrow(NotFoundException);
    expect(notifications.accountActivated).not.toHaveBeenCalled();
  });
});
