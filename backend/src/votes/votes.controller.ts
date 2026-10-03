import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateVoteDto } from './dto/create-vote.dto';
import { VotesService } from './votes.service';

@Controller('events/:eventId')
@UseGuards(JwtAuthGuard)
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Post('votes')
  cast(
    @Param('eventId') eventId: string,
    @Body() dto: CreateVoteDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.votesService.cast(eventId, dto.candidateIds, user);
  }

  @Get('votes/me')
  mine(@Param('eventId') eventId: string, @CurrentUser() user: UserDocument) {
    return this.votesService.mine(eventId, user);
  }

  @Get('results')
  results(
    @Param('eventId') eventId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.votesService.results(eventId, user);
  }
}
