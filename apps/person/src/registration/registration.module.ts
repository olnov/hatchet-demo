import { Module } from '@nestjs/common';

import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { HatchetModule } from '../hatchet/hatchet.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HatchetModule, AuthModule, PrismaModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
