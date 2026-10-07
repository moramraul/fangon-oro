import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleTokenService } from './google-token.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PasswordRecoveryService } from './password-recovery.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),

    UsersModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRateLimitGuard,
    AuthService,
    JwtStrategy,
    GoogleTokenService,
    PasswordRecoveryService,
  ],
})
export class AuthModule {}
