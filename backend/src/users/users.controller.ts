import { Body, Controller, Get, Post } from '@nestjs/common';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: { name: string; email: string }) {
    return this.usersService.create(body.name, body.email);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
