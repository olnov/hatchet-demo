import {
  PROFILE_COMPLETED_EVENT,
  ProfileCompletedSchema,
  profileScope,
  type AwaitProfileOutput,
  type OnboardingInput,
} from '@contracts';
import type { DurableContext } from '@hatchet-dev/typescript-sdk';

type SaveProfile = (
  personId: string,
  profile: {
    firstName: string;
    lastName: string;
    personalStatement: string;
  },
) => Promise<{ id: string }>;

export async function awaitAndSaveProfile(
  input: OnboardingInput,
  ctx: DurableContext<OnboardingInput>,
  saveProfile: SaveProfile,
): Promise<AwaitProfileOutput> {
  const profile = await ctx.waitForEvent(
    PROFILE_COMPLETED_EVENT,
    `input.personId == '${input.personId}'`,
    ProfileCompletedSchema,
    profileScope(input.personId),
    '25h',
  );

  const savedProfile = await saveProfile(input.personId, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    personalStatement: profile.personalStatement,
  });

  return { timedOut: false, profileId: savedProfile.id };
}
