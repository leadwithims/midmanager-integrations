import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Add tenant header to response for tracking
  app.use((req, res, next) => {
    res.setHeader('x-tenant-id', 'default');
    next();
  });

  await app.listen(3005);
}
bootstrap();