import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { PersonsController } from './persons.controller.js';
import { PersonsService } from './persons.service.js';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService, PrismaService],
  exports: [PersonsService],
})
export class PersonsModule {}
