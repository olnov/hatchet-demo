import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ONBOARDING_WORKFLOW, STEP } from '@contracts';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';

import { OnboardingStarter } from '../hatchet/onboarding-starter.service';
import { hatchet } from '../hatchet/client.js';
import { issueProfileLink } from '../hatchet/issue-profile-link.js';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly onboardingStarter: OnboardingStarter,
  ) {}

  async register(data: RegisterDto) {
    try {
      const person = await this.prisma.person.create({
        data: {
          email: data.email,
          passwordHash: await this.auth.hashPassword(data.password),
        },
      });

      // Запускаем workflow. Получаем id задачи и записываем ее в таблицу.
      const runId = await this.onboardingStarter.start(person.id, person.email);
      await this.prisma.person.update({
        where: { id: person.id },
        data: { onboardingRunId: runId },
      });

      return { personId: person.id, email: person.email, runId };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('A person with this email already exists');
      }

      throw error;
    }
  }

  async getRegistrationTaskStatus(runId: string) {
    const person = await this.prisma.person.findFirst({
      where: { onboardingRunId: runId },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('Registration run was not found');
    }

    const runs = await hatchet.runs.list({
      additionalMetadata: { personId: person.id },
      onlyTasks: false,
      limit: 10,
    });
    const run = runs.rows?.find(
      (item) => item.workflowRunExternalId === runId,
    );

    if (!run) {
      throw new NotFoundException('Registration run was not found');
    }

    if (run.status === 'COMPLETED') {
      return { status: 'completed' as const };
    }

    if (run.status === 'FAILED' || run.status === 'CANCELLED') {
      return { status: 'failed' as const };
    }

    const issueLink = run.children?.find(
      (task) => task.actionId === `${ONBOARDING_WORKFLOW}:${STEP.issueLink}`,
    );

    if (issueLink?.status === 'COMPLETED') {
      const link = await issueProfileLink(person.id);
      return { status: 'linkReady' as const, profileUrl: link.profileUrl };
    }

    return { status: 'pending' as const };
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

}
