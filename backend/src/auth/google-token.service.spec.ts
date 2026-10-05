import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleTokenService } from './google-token.service';

describe('Google token verification', () => {
  const config = {
    get: jest.fn().mockReturnValue('client.apps.googleusercontent.com'),
  };
  const service = new GoogleTokenService(config as unknown as ConfigService);
  const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('client.apps.googleusercontent.com');
  });
  afterAll(() => verify.mockRestore());

  function payload(value: Record<string, unknown>) {
    verify.mockResolvedValue({ getPayload: () => value } as never);
  }

  it('passes the configured audience to Google verification', async () => {
    payload({
      sub: 'google-123',
      email: 'ana@gmail.com',
      email_verified: true,
      name: 'Ana',
    });
    await expect(service.verify('signed-token')).resolves.toMatchObject({
      googleId: 'google-123',
      authoritativeEmail: true,
    });
    expect(verify).toHaveBeenCalledWith({
      idToken: 'signed-token',
      audience: 'client.apps.googleusercontent.com',
    });
  });

  it('rejects a token that fails signature, audience or expiration verification', async () => {
    verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });
    await expect(service.verify('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects unverified email', async () => {
    payload({
      sub: 'google-123',
      email: 'ana@gmail.com',
      email_verified: false,
    });
    await expect(service.verify('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('does not treat third-party email as authoritative', async () => {
    payload({
      sub: 'google-123',
      email: 'ana@example.com',
      email_verified: true,
    });
    await expect(service.verify('token')).resolves.toMatchObject({
      authoritativeEmail: false,
    });
  });

  it('fails closed when Google is not configured', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.verify('token')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(verify).not.toHaveBeenCalled();
  });
});
