import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Only explicitly trusted proxy addresses/subnets may supply client IPs.
  const trustedProxies = process.env.TRUSTED_PROXY_IPS?.trim();
  if (trustedProxies)
    app.set(
      'trust proxy',
      trustedProxies.split(',').map((ip) => ip.trim()),
    );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exitCode = 1;
});
