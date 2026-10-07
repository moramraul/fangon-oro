import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from './authenticated-user';
import { UserDocument } from '../users/schemas/user.schema';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginDto } from './dto/login.dto';
import { registerDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CreatePasswordDto } from './dto/create-password.dto';
import { PasswordRecoveryService } from './password-recovery.service';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-recovery.dto';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly recovery: PasswordRecoveryService,
  ) {}

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.recovery.forgot(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.recovery.reset(body.token, body.password);
  }

  @Post('register')
  register(@Body() registerDto: registerDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('google')
  googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.credential);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMe(@CurrentUser() user: UserDocument) {
    return {
      id: user._id.toHexString(),
      name: user.name,
      avatar: user.avatar,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      hasPassword: await this.authService.hasPassword(user._id.toHexString()),
      hasGoogle: Boolean(user.googleId),
      passwordPromptSeen: user.passwordPromptSeen === true,
    };
  }

  @Post('me/password-prompt')
  @UseGuards(JwtAuthGuard)
  async acknowledgePasswordPrompt(@CurrentUser() user: UserDocument) {
    return this.getMe(
      await this.authService.acknowledgePasswordPrompt(user._id.toHexString()),
    );
  }

  @Post('me/password')
  @UseGuards(JwtAuthGuard)
  async createPassword(
    @CurrentUser() user: UserDocument,
    @Body() body: CreatePasswordDto,
  ) {
    return this.getMe(
      await this.authService.createPassword(
        user._id.toHexString(),
        body.password,
      ),
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: UserDocument,
    @Body() profile: UpdateProfileDto,
  ) {
    const updated = await this.authService.updateProfile(
      user._id.toHexString(),
      profile,
    );
    return this.getMe(updated);
  }
}
