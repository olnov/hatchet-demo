import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { InfoModule } from './info/info.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  controllers: [HealthController],
  imports: [ConfigModule.forRoot({ isGlobal: true }), InfoModule, PrismaModule],
})
export class AppModule {}
