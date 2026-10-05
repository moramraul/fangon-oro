import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { OverviewService } from './overview.service';

@Controller('overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  @Get()
  overview(@CurrentUser() user: UserDocument) {
    return this.service.overview(user);
  }

  @Get('events/:id/results')
  results(@Param('id') id: string) {
    return this.service.results(id);
  }
}
