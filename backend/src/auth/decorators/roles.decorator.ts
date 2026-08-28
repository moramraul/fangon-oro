import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: ('USER' | 'ADMIN')[]) =>
  SetMetadata('roles', roles);
