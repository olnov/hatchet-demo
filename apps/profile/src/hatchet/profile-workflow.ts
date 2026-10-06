import { buildOnboardingWorkflow, STEP, type StepImpls } from '@contracts';

import type { InfoService } from '../info/info.service.js';
import { awaitAndSaveProfile } from './await-and-save-profile.js';
import { hatchet } from './client.js';

export function createProfileOnboardingWorkflow(info: InfoService) {
  const profileSteps: StepImpls = {
    [STEP.awaitProfile]: async (input, ctx) =>
      awaitAndSaveProfile(input, ctx, info.saveCompletedProfile.bind(info)),
  };

  return buildOnboardingWorkflow(hatchet, profileSteps);
}
