import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { InfoModule } from './info/info.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfileLinksModule } from './profile-links/profile-links.module.js';
import { HatchetModule } from './hatchet/hatchet.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InfoModule,
    PrismaModule,
    ProfileLinksModule,
    HatchetModule,
  ],
})
export class AppModule {}
