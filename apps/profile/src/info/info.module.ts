import { Module } from '@nestjs/common';
import { InfoService } from './info.service.js';
import { InfoController } from './info.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProfileLinksModule } from '../profile-links/profile-links.module.js';
import { PersonClientModule } from '../person-client/person-client.module.js';

@Module({
  imports: [ProfileLinksModule, PersonClientModule],
  providers: [InfoService, PrismaService],
  controllers: [InfoController],
})
export class InfoModule {}
