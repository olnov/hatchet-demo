import { Module } from '@nestjs/common';

import { InfoModule } from '../info/info.module.js';
import { ProfileWorkerService } from './profile-worker.service.js';

@Module({
  imports: [InfoModule],
  providers: [ProfileWorkerService],
})
export class HatchetModule {}
