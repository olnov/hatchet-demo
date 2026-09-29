import { ConflictException, Injectable } from '@nestjs/common';

import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async register(data: RegisterDto) {
    try {
      const person = await this.prisma.person.create({
        data: {
          email: data.email,
          passwordHash: await this.auth.hashPassword(data.password),
        },
      });

      return { personId: person.id, email: person.email };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A person with this email already exists');
      }

      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
