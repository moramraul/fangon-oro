import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { EditionsService } from './editions.service';

@Controller('editions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EditionsController {
  constructor(private readonly editions: EditionsService) {}
  @Get() list() {
    return this.editions.list();
  }
  @Post(':id/close')
  @Roles('ADMIN')
  close(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.editions.close(id, user._id);
  }
}
