import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UpdateActivationDto } from './dto/update-activation.dto';

import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/activation')
  @Roles('ADMIN')
  updateActivation(@Param('id') id: string, @Body() dto: UpdateActivationDto) {
    return this.usersService.updateActivation(id, dto.isActive);
  }

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.usersService.findAll();
  }
}
