import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string) {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) {
      throw new NotFoundException('Person was not found');
    }

    return {
      id: person.id,
      email: person.email,
      isProfileCompleted: person.isProfileCompleted,
      createdAt: person.createdAt,
    };
  }

  async markProfileCompleted(id: string) {
    await this.get(id);
    const person = await this.prisma.person.update({
      where: { id },
      data: { isProfileCompleted: true },
    });

    return {
      id: person.id,
      email: person.email,
      isProfileCompleted: person.isProfileCompleted,
      createdAt: person.createdAt,
    };
  }
}
