import type { Context, DurableContext, HatchetClient } from '@hatchet-dev/typescript-sdk';

import type {
  AwaitProfileOutput,
  IssueLinkOutput,
  MarkCompletedOutput,
  OnboardingInput,
} from './constants.js';
import { ONBOARDING_WORKFLOW, requiredLabelFor, STEP } from './steps.js';

export type StepImpls = Partial<{
  [STEP.issueLink]: (input: OnboardingInput, ctx: Context<OnboardingInput>) => Promise<IssueLinkOutput>;
  [STEP.awaitProfile]: (input: OnboardingInput, ctx: DurableContext<OnboardingInput>) => Promise<AwaitProfileOutput>;
  [STEP.markCompleted]: (input: OnboardingInput, ctx: Context<OnboardingInput>) => Promise<MarkCompletedOutput>;
}>;

const notMyStep = (step: string) => async () => {
  throw new Error(`NOT_MY_STEP: ${step}`);
};

/** Builds the same five-step DAG for both Person and Profile workers. */
export function buildOnboardingWorkflow(hatchet: HatchetClient, impls: StepImpls) {
  const workflow = hatchet.workflow<OnboardingInput>({ name: ONBOARDING_WORKFLOW });
  const issueLink = workflow.task({
    name: STEP.issueLink,
    fn: impls[STEP.issueLink] ?? notMyStep(STEP.issueLink),
    retries: 5,
    desiredWorkerLabels: requiredLabelFor(STEP.issueLink),
  });
  const awaitProfile = workflow.durableTask({
    name: STEP.awaitProfile,
    fn: impls[STEP.awaitProfile] ?? notMyStep(STEP.awaitProfile),
    parents: [issueLink],
    executionTimeout: '25h',
    desiredWorkerLabels: requiredLabelFor(STEP.awaitProfile),
  });
  const markCompleted = workflow.task({
    name: STEP.markCompleted,
    fn: impls[STEP.markCompleted] ?? notMyStep(STEP.markCompleted),
    parents: [awaitProfile],
    desiredWorkerLabels: requiredLabelFor(STEP.markCompleted),
  });
  return workflow;
}
