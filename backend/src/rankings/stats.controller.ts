import { CurrentUser } from '../auth/authenticated-user';
import { UserDocument } from '../users/schemas/user.schema';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(@CurrentUser() user: UserDocument, @Query('edition') edition?: string) {
    return this.stats.get(edition, user.role);
  }
}
