import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  controllers: [HealthController],
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, HealthModule, UserModule, AuthModule],
})
export class AppModule {}
