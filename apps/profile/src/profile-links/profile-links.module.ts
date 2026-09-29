import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileLinksController } from './profile-links.controller.js';
import { ProfileLinksService } from './profile-links.service.js';

@Module({
  controllers: [ProfileLinksController],
  providers: [ProfileLinksService, PrismaService],
  exports: [ProfileLinksService],
})
export class ProfileLinksModule {}
