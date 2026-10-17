import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, STATES } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    if (this.connection.readyState !== STATES.connected || !this.connection.db)
      throw new ServiceUnavailableException('Service unavailable');
    try {
      await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
    } catch {
      throw new ServiceUnavailableException('Service unavailable');
    }
    return { status: 'ok' };
  }
}
