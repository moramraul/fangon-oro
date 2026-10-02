import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserDocument } from '../users/schemas/user.schema';
import {
  CreateEventDto,
  SetEventStatusDto,
  SetParticipantsDto,
  UpdateEventDto,
} from './dto/event.dto';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(@CurrentUser() user: UserDocument) {
    return this.eventsService.listMine(user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.eventsService.getDetail(id, user);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEventDto, @CurrentUser() user: UserDocument) {
    return this.eventsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Put(':id/participants')
  @Roles('ADMIN')
  participants(@Param('id') id: string, @Body() dto: SetParticipantsDto) {
    return this.eventsService.setParticipants(id, dto.participantIds);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  status(@Param('id') id: string, @Body() dto: SetEventStatusDto) {
    return this.eventsService.setStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}

@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles('ADMIN')
  list() {
    return this.eventsService.listAll();
  }
}
