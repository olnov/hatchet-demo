import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Module({
  providers: [UserService, PrismaService, AuthService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
