import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';

const MINUTE = 60_000;
const MAX_BUCKETS = 10_000;
const POLICIES: Record<string, { limit: number; window: number }> = {
  login: { limit: 20, window: 5 * MINUTE },
  googleLogin: { limit: 20, window: 5 * MINUTE },
  forgotPassword: { limit: 5, window: 15 * MINUTE },
  resetPassword: { limit: 10, window: 15 * MINUTE },
  register: { limit: 5, window: 15 * MINUTE },
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { attempts: number[]; window: number }
  >();
  private nextCleanup = 0;

  canActivate(context: ExecutionContext): boolean {
    const action = context.getHandler().name;
    const policy = POLICIES[action];
    if (!policy) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Express resolves this from the socket unless trusted proxies are configured.
    // Never read X-Forwarded-For directly: clients can forge that header.
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    if (now >= this.nextCleanup) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.attempts[bucket.attempts.length - 1] + bucket.window <= now)
          this.buckets.delete(key);
      }
      this.nextCleanup = now + MINUTE;
    }

    // Login and Google share their IP budget, preventing endpoint switching.
    this.consume(
      `${action === 'googleLogin' ? 'login' : action}:${ip}`,
      policy,
      now,
      response,
    );
    const body = request.body as { email?: unknown } | undefined;
    if (action === 'login' && typeof body?.email === 'string') {
      const email = createHash('sha256')
        .update(body.email.trim().toLowerCase())
        .digest('hex');
      this.consume(
        `credentials:${ip}:${email}`,
        { limit: 5, window: 5 * MINUTE },
        now,
        response,
      );
    }
    return true;
  }

  private consume(
    key: string,
    policy: { limit: number; window: number },
    now: number,
    response: Response,
  ) {
    const bucket = this.buckets.get(key) ?? {
      attempts: [],
      window: policy.window,
    };
    bucket.attempts = bucket.attempts.filter(
      (attempt) => attempt + policy.window > now,
    );
    if (bucket.attempts.length >= policy.limit) {
      this.reject(response, bucket.attempts[0] + policy.window - now);
    }
    // Keep memory bounded without evicting active limits during a flood.
    if (!this.buckets.has(key) && this.buckets.size >= MAX_BUCKETS)
      this.reject(response, MINUTE);
    bucket.attempts.push(now);
    this.buckets.set(key, bucket);
  }

  private reject(response: Response, wait: number): never {
    response.setHeader('Retry-After', Math.max(1, Math.ceil(wait / 1000)));
    throw new HttpException(
      'Demasiados intentos. Espera antes de volver a probar.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
