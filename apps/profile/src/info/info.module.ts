import { Module } from '@nestjs/common';
import { InfoService } from './info.service.js';
import { InfoController } from './info.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileLinksModule } from '../profile-links/profile-links.module.js';

@Module({
  imports: [ProfileLinksModule],
  providers: [InfoService, PrismaService],
  controllers: [InfoController],
  exports: [InfoService],
})
export class InfoModule {}
