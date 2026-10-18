import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('User removal', () => {
  const id = new Types.ObjectId();
  const model = { findByIdAndDelete: jest.fn() };
  const service = new UsersService(
    model as unknown as Model<UserDocument>,
    {} as NotificationsService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('removes the account and returns only its identifier', async () => {
    model.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: id, email: 'ana@example.com' }),
    });
    await expect(service.remove(id.toHexString())).resolves.toEqual({
      id: id.toHexString(),
    });
    expect(model.findByIdAndDelete).toHaveBeenCalledWith(id.toHexString());
  });

  it('rejects malformed identifiers without querying the database', async () => {
    await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    expect(model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('returns not found for a missing account', async () => {
    model.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(service.remove(id.toHexString())).rejects.toThrow(
      NotFoundException,
    );
  });
});
