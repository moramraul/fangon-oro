import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';

describe('Authentication rate limits (HTTP)', () => {
  let app: NestExpressApplication<Server>;
  let now: number;
  const auth = {
    login: jest.fn(),
    googleLogin: jest.fn(),
    register: jest.fn(),
  };
  const recovery = { forgot: jest.fn(), reset: jest.fn() };
  const credentials = { email: 'ana@example.com', password: 'password123' };

  beforeEach(async () => {
    jest.clearAllMocks();
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    auth.login.mockImplementation(() => {
      throw new UnauthorizedException();
    });
    auth.googleLogin.mockResolvedValue({ accessToken: 'test' });
    auth.register.mockResolvedValue({ isActive: false });
    recovery.forgot.mockResolvedValue({ message: 'Respuesta genérica' });
    recovery.reset.mockResolvedValue({ message: 'Actualizada' });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthRateLimitGuard,
        { provide: AuthService, useValue: auth },
        { provide: PasswordRecoveryService, useValue: recovery },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication<Server>>();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('blocks the sixth login before checking credentials, normalizes email and expires', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);
    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, email: 'ANA@example.com' })
      .expect(429);
    expect(blocked.headers['retry-after']).toBe('300');
    expect(auth.login).toHaveBeenCalledTimes(5);
    now += 5 * 60_000;
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(401);
    expect(auth.login).toHaveBeenCalledTimes(6);
  });

  it('uses a rolling window and reports remaining waiting time', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(401);
    now += 60_000;
    for (let i = 0; i < 4; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);
    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(429);
    expect(blocked.headers['retry-after']).toBe('240');
    now += 240_000;
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(429);
  });

  it('cannot bypass the IP budget by rotating emails or spoofing forwarding headers', async () => {
    for (let i = 0; i < 20; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', `192.0.2.${i + 1}`)
        .send({ ...credentials, email: `user${i}@example.com` })
        .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.1')
      .send(credentials)
      .expect(429);
    await request(app.getHttpServer())
      .post('/auth/google')
      .send({ credential: 'test' })
      .expect(429);
    expect(auth.googleLogin).not.toHaveBeenCalled();
  });

  it('keeps different client IPs independent behind an explicitly trusted proxy', async () => {
    app.set('trust proxy', 'loopback');
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', '192.0.2.1')
        .send(credentials)
        .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .send(credentials)
      .expect(429);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', '192.0.2.2')
      .send(credentials)
      .expect(401);
  });

  it('limits recovery requests even for unknown accounts and leaves login available', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `unknown${i}@example.com` })
        .expect(201);
    const blocked = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(429);
    expect(blocked.headers['retry-after']).toBe('900');
    expect(recovery.forgot).toHaveBeenCalledTimes(5);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(401);
    now += 900_000;
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(201);
  });

  it.each([
    ['/auth/register', 5, { ...credentials, name: 'Ana' }],
    [
      '/auth/reset-password',
      10,
      { token: 'a'.repeat(64), password: credentials.password },
    ],
    ['/auth/google', 20, { credential: 'test' }],
  ])('limits %s', async (path, limit, body) => {
    for (let i = 0; i < limit; i++)
      await request(app.getHttpServer()).post(path).send(body).expect(201);
    await request(app.getHttpServer()).post(path).send(body).expect(429);
  });

  it('counts invalid payloads before validation', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({})
        .expect(400);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(429);
    expect(recovery.forgot).not.toHaveBeenCalled();
  });
});
