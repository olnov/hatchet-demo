import { Module } from '@nestjs/common';

import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService, PrismaService, AuthService],
})
export class RegistrationModule {}
