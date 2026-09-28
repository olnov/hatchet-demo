import { Module } from '@nestjs/common';
import { InfoService } from './info.service.js';
import { InfoController } from './info.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  providers: [InfoService, PrismaService],
  controllers: [InfoController],
})
export class InfoModule {}
