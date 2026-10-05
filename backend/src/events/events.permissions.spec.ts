import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersController } from '../users/users.controller';
import { AdminEventsController, EventsController } from './events.controller';

describe('Administrative route permissions', () => {
  const guard = new RolesGuard(new Reflector());
  // Inspect decorator metadata on the original handlers; these methods are never invoked.
  /* eslint-disable @typescript-eslint/unbound-method */
  const routes = [
    EventsController.prototype.create,
    EventsController.prototype.update,
    EventsController.prototype.participants,
    EventsController.prototype.status,
    EventsController.prototype.remove,
    AdminEventsController.prototype.list,
    UsersController.prototype.findAll,
    UsersController.prototype.updateActivation,
  ];
  /* eslint-enable @typescript-eslint/unbound-method */

  function context(handler: unknown, role: 'USER' | 'ADMIN'): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => EventsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
  }

  it.each(routes)('rejects USER on administrative handler %p', (handler) => {
    expect(() => guard.canActivate(context(handler, 'USER'))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(context(handler, 'ADMIN'))).toBe(true);
  });
});
