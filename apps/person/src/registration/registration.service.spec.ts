import { NotFoundException } from '@nestjs/common';
import { ONBOARDING_WORKFLOW, STEP } from '@contracts';
import { describe, expect, it, vi } from 'vitest';

const { list, issueProfileLink } = vi.hoisted(() => ({
  list: vi.fn(),
  issueProfileLink: vi.fn(),
}));

vi.mock('../hatchet/client.js', () => ({
  hatchet: { runs: { list } },
}));

vi.mock('../hatchet/issue-profile-link.js', () => ({ issueProfileLink }));

import { RegistrationService } from './registration.service.js';

function createService() {
  return new RegistrationService(
    { person: { findFirst: vi.fn().mockResolvedValue({ id: 'person-1' }) } } as never,
    {} as never,
    {} as never,
  );
}

function run(status: string, issueStatus?: string) {
  return {
    workflowRunExternalId: 'run-1',
    actionId: '',
    status,
    children: issueStatus
      ? [{ actionId: `${ONBOARDING_WORKFLOW}:${STEP.issueLink}`, status: issueStatus }]
      : [],
  };
}

describe('RegistrationService.getRegistrationTaskStatus', () => {
  it('returns the profile URL after the issue-link task completes', async () => {
    list.mockResolvedValue({ rows: [run('RUNNING', 'COMPLETED')] });
    issueProfileLink.mockResolvedValue({
      token: 'token-1',
      profileUrl: 'http://localhost:3000/profile/token-1',
    });

    await expect(createService().getRegistrationTaskStatus('run-1')).resolves.toEqual({
      status: 'linkReady',
      profileUrl: 'http://localhost:3000/profile/token-1',
    });
    expect(issueProfileLink).toHaveBeenCalledWith('person-1');
  });

  it('returns pending when the issue-link task has no output yet', async () => {
    list.mockResolvedValue({ rows: [run('RUNNING')] });

    await expect(createService().getRegistrationTaskStatus('run-1')).resolves.toEqual({
      status: 'pending',
    });
  });

  it('returns completed when the whole workflow completes', async () => {
    list.mockResolvedValue({ rows: [run('COMPLETED')] });

    await expect(createService().getRegistrationTaskStatus('run-1')).resolves.toEqual({
      status: 'completed',
    });
  });

  it('returns failed when Hatchet marks the run as failed', async () => {
    list.mockResolvedValue({ rows: [run('FAILED')] });

    await expect(createService().getRegistrationTaskStatus('run-1')).resolves.toEqual({
      status: 'failed',
    });
  });

  it('maps a missing Hatchet run to 404', async () => {
    list.mockResolvedValue({ rows: [] });

    await expect(createService().getRegistrationTaskStatus('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
