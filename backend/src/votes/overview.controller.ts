import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { OverviewService } from './overview.service';

@Controller('overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  @Get()
  overview(
    @CurrentUser() user: UserDocument,
    @Query('edition') edition?: string,
  ) {
    return this.service.overview(user, edition);
  }

  @Get('reveal/:editionId')
  reveal(
    @CurrentUser() user: UserDocument,
    @Param('editionId') editionId: string,
  ) {
    return this.service.overview(user, editionId, true);
  }

  @Get('events/:id/results')
  results(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.service.results(id, user.role);
  }
}
