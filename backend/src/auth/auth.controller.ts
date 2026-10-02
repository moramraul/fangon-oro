import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './authenticated-user';
import { UserDocument } from '../users/schemas/user.schema';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginDto } from './dto/login.dto';
import { registerDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: registerDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getMe(@CurrentUser() user: UserDocument) {
    return {
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
