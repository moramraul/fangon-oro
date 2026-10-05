import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleTokenService {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verify(credential: string) {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!audience)
      throw new ServiceUnavailableException('Google login is not configured');
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Unverified Google identity');
      }
      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        name: payload.name || payload.email.split('@')[0],
        authoritativeEmail:
          payload.email.endsWith('@gmail.com') || Boolean(payload.hd),
      };
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
