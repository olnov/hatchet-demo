import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RegistrationModule } from './registration/registration.module.js';
import { PersonsModule } from './persons/persons.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UserModule,
    AuthModule,
    RegistrationModule,
    PersonsModule,
  ],
})
export class AppModule {}
