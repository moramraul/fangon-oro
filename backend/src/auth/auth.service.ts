import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { registerDto } from './dto/register.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleTokenService } from './google-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly googleTokens: GoogleTokenService,
  ) {}

  async register(registerDto: registerDto) {
    const user = await this.usersService.create(registerDto);

    return {
      id: user._id.toHexString(),
      isActive: user.isActive,
      message:
        'Pendiente de activación por parte del administrador. Recibirás un correo de confirmación.',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive !== true) {
      throw new ForbiddenException(
        'Cuenta desactivada. Contacta con un administrador para activarla.',
      );
    }

    return this.generateToken(user);
  }

  async googleLogin(credential: string) {
    const identity = await this.googleTokens.verify(credential);
    const user = await this.usersService.findOrCreateGoogleUser(identity);
    if (user.isActive !== true) {
      throw new ForbiddenException(
        'Cuenta desactivada. Contacta con un administrador para activarla.',
      );
    }
    return this.generateToken(user);
  }

  private async generateToken(user: UserDocument) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion ?? 0,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  updateProfile(id: string, profile: UpdateProfileDto) {
    return this.usersService.updateProfile(id, profile);
  }

  hasPassword(id: string) {
    return this.usersService.hasPassword(id);
  }
  acknowledgePasswordPrompt(id: string) {
    return this.usersService.acknowledgePasswordPrompt(id);
  }
  createPassword(id: string, password: string) {
    return this.usersService.createPassword(id, password);
  }
}
