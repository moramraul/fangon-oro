import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { RankingsService } from './rankings.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('events/:eventId/ranking')
  forEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.rankingsService.forEvent(eventId, user);
  }

  @Get('rankings/general')
  general() {
    return this.rankingsService.general();
  }
}
