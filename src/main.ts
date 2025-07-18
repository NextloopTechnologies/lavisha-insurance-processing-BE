import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from 'filters/primsa-exception.filter';
import { plainToInstance } from 'class-transformer';
import { EnvSchema } from './config/env.validation';
import { validateSync } from 'class-validator';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  
  // Env validaton
  const envConfig = plainToInstance(EnvSchema, process.env, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(envConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    console.error('❌ Invalid environment variables', errors);
    process.exit(1);
  }

  if (process.env.ENABLE_FILE_UPLOAD === 'true') {
    const requiredAwsVars = ['AWS_REGION', 'AWS_BUCKET_NAME', 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY'];
    const missing = requiredAwsVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      console.error(`❌ Missing AWS config variables: ${missing.join(', ')}`);
      process.exit(1);
    }
  }
  
  // Nest
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new PrismaExceptionFilter);

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT') || 8000;

  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', '')
    .split(',')
    .map(origin => origin.trim())

  const corsOption: CorsOptions = {
    origin: (
      origin: string|undefined, 
      callback: (err: Error, allow?: boolean) => void
    ): void => {
      if(!origin || allowedOrigins.includes(origin)){
        callback(null, true)
      } else {
        callback(new Error(`❌ Origin ${origin} not allowed by CORS`))
      }
    }
  }

  app.enableCors(corsOption)

  await app.listen(PORT);
  console.log(`🚀 Application is running on: http://localhost:${PORT}`);
}
bootstrap();
