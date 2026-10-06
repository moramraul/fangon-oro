import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { GoogleTokenService } from './google-token.service';

describe('Account activation', () => {
  const user = {
    _id: new Types.ObjectId(),
    email: 'ana@example.com',
    role: 'USER',
    passwordHash: '',
    isActive: false,
  };
  const users = {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findOrCreateGoogleUser: jest.fn(),
  };
  const google = { verify: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    google as unknown as GoogleTokenService,
  );
  const credentials = { email: user.email, password: 'password123' };

  beforeEach(async () => {
    jest.clearAllMocks();
    user.isActive = false;
    user.passwordHash = await bcrypt.hash(credentials.password, 4);
    users.create.mockResolvedValue(user);
    users.findByEmailWithPassword.mockResolvedValue(user);
  });

  it('registers without issuing a token', async () => {
    expect(
      await service.register({ ...credentials, name: 'Ana' }),
    ).toMatchObject({
      isActive: false,
      message:
        'Pendiente de activación por parte del administrador. Recibirás un correo de confirmación.',
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid Google credentials before accessing users', async () => {
    google.verify.mockRejectedValue(new UnauthorizedException());
    await expect(service.googleLogin('invalid')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('keeps Google accounts pending activation', async () => {
    google.verify.mockResolvedValue({ googleId: '123', email: user.email });
    users.findOrCreateGoogleUser.mockResolvedValue(user);
    await expect(service.googleLogin('credential')).rejects.toThrow(
      ForbiddenException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('issues the app token after verifying an active Google user', async () => {
    user.isActive = true;
    const identity = { googleId: '123', email: user.email };
    google.verify.mockResolvedValue(identity);
    users.findOrCreateGoogleUser.mockResolvedValue(user);
    await expect(service.googleLogin('credential')).resolves.toEqual({
      accessToken: 'token',
    });
    expect(google.verify).toHaveBeenCalledWith('credential');
    expect(users.findOrCreateGoogleUser).toHaveBeenCalledWith(identity);
  });

  it('rejects inactive users with valid credentials', async () => {
    await expect(service.login(credentials)).rejects.toThrow(
      ForbiddenException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('checks credentials before disclosing activation status', async () => {
    await expect(
      service.login({ ...credentials, password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('issues a token to an active user', async () => {
    user.isActive = true;
    await expect(service.login(credentials)).resolves.toEqual({
      accessToken: 'token',
    });
  });
});
