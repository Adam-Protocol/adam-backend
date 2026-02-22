import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({ origin: '*' });

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Adam Protocol API')
    .setDescription('Privacy-first stablecoin offramp on Starknet')
    .setVersion('1.0')
    .addTag('token', 'Buy and sell ADUSD / ADNGN')
    .addTag('swap', 'Swap between ADUSD and ADNGN')
    .addTag('offramp', 'Bank transfer status and webhooks')
    .addTag('activity', 'Transaction history per wallet')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Adam Protocol API running on http://localhost:${port}/api`);
}

bootstrap();
