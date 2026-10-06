import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { Worker } from '@hatchet-dev/typescript-sdk';

import { PersonsService } from '../persons/persons.service.js';
import { hatchet } from './client.js';
import { createPersonOnboardingWorkflow } from './person-workflow.js';

@Injectable()
export class PersonWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PersonWorkerService.name);
  private worker?: Worker;

  constructor(private readonly persons: PersonsService) {}

  async onApplicationBootstrap() {
    const workflow = createPersonOnboardingWorkflow(this.persons);

    this.worker = await hatchet.worker('person-worker', {
      labels: { service: 'person' },
      workflows: [workflow],
    });

    void this.worker.start().catch((error: unknown) => {
      this.logger.error(
        'Hatchet person worker stopped',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async onApplicationShutdown() {
    await this.worker?.stop();
  }
}
