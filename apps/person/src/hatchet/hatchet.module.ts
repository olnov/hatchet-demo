import { Module } from '@nestjs/common';
import { OnboardingStarter } from './onboarding-starter.service';
import { PersonWorkerService } from './person-worker.service';
import { PersonsModule } from '../persons/persons.module';

@Module({
  imports: [PersonsModule],
  providers: [OnboardingStarter, PersonWorkerService],
  exports: [OnboardingStarter],
})
export class HatchetModule {}
