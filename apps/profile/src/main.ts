import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Profile API')
    .setDescription('The Profile API description')
    .setVersion('1.0')
    .build();

  const documentOptions: SwaggerDocumentOptions = {
    standardSchemaConverter: (schema, { schemaType }) => {
      const converted = createSchema(schema as never, {
        io: schemaType,
        openapiVersion: '3.0.0',
      });
      return { schema: converted.schema, components: converted.components };
    },
  };

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, documentOptions);

  SwaggerModule.setup('api/v1/docs', app, documentFactory());

  await app.listen(process.env.PROFILE_PORT ?? 3002);
}
await bootstrap();
