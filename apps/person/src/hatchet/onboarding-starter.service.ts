import { Injectable } from "@nestjs/common";
import { buildOnboardingWorkflow } from "@contracts";

import { hatchet } from "./client";

@Injectable()
export class OnboardingStarter {
    private readonly workflow = buildOnboardingWorkflow(hatchet, {});

    async start(personId: string, email: string): Promise<string> {
        const ref = await this.workflow.runNoWait(
            { personId, email },
            { additionalMetadata: { personId } },
        );

        return await ref.getWorkflowRunId();
    }
}