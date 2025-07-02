import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT') || 8000;
  await app.listen(PORT);
  console.log(`🚀 Application is running on: http://localhost:${PORT}`);
}
bootstrap();
