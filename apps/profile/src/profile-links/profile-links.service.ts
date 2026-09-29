import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProfileLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issue(personId: string) {
    const current = await this.prisma.profileLink.findUnique({
      where: { personId },
    });

    if (current && current.usedAt === null && current.expiresAt > new Date()) {
      return this.toResponse(current);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    const link = current
      ? await this.prisma.profileLink.update({
          where: { personId },
          data: { token, expiresAt, usedAt: null },
        })
      : await this.prisma.profileLink.create({
          data: { token, personId, expiresAt },
        });

    return this.toResponse(link);
  }

  async requireActive(token: string) {
    const link = await this.prisma.profileLink.findUnique({ where: { token } });

    if (!link) {
      throw new NotFoundException('Profile link was not found');
    }

    if (link.usedAt !== null || link.expiresAt <= new Date()) {
      throw new GoneException('Profile link has expired or was already used');
    }

    return link;
  }

  async markUsed(token: string): Promise<void> {
    await this.prisma.profileLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  private toResponse(link: { token: string; expiresAt: Date }) {
    const origin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';

    return {
      token: link.token,
      profileUrl: `${origin}/profile/${link.token}`,
      expiresAt: link.expiresAt,
    };
  }
}
