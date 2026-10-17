import { ServiceUnavailableException } from '@nestjs/common';
import { Connection } from 'mongoose';
import { HealthController } from './health.controller';

describe('Readiness', () => {
  const command = jest.fn();
  let controller: HealthController;

  beforeEach(() => {
    command.mockReset().mockResolvedValue({ ok: 1 });
    controller = new HealthController({
      readyState: 1,
      db: { command },
    } as unknown as Connection);
  });

  it('checks the database before reporting healthy', async () => {
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2000 });
  });

  it('reports unavailable when disconnected', async () => {
    controller = new HealthController({ readyState: 0 } as Connection);
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(command).not.toHaveBeenCalled();
  });

  it('does not disclose database errors to the public health endpoint', async () => {
    command.mockRejectedValue(new Error('private connection details'));
    await expect(controller.check()).rejects.toThrow('Service unavailable');
  });
});
