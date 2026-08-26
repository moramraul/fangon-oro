import { Body, Controller, Get, Post } from '@nestjs/common';

import { UsersService } from './users.service';
import { registerDto } from '../auth/dto/register.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() registerDto: registerDto) {
    return this.usersService.create(registerDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
