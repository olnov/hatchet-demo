import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Worker } from '@hatchet-dev/typescript-sdk';

import { InfoService } from '../info/info.service.js';
import { hatchet } from './client.js';
import { createProfileOnboardingWorkflow } from './profile-workflow.js';

@Injectable()
export class ProfileWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ProfileWorkerService.name);
  private worker?: Worker;

  constructor(private readonly info: InfoService) {}

  async onApplicationBootstrap() {
    const workflow = createProfileOnboardingWorkflow(this.info);

    this.worker = await hatchet.worker('profile-worker', {
      labels: { service: 'profile' },
      workflows: [workflow],
    });

    void this.worker.start().catch((error: unknown) => {
      this.logger.error(
        'Hatchet profile worker stopped',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async onApplicationShutdown() {
    await this.worker?.stop();
  }
}
