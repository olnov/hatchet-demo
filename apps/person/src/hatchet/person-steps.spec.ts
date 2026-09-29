import { describe, expect, it, vi } from 'vitest';

import { issueProfileLink } from './issue-profile-link.js';
import { markProfileCompleted } from './mark-profile-completed.js';

describe('Person onboarding steps', () => {
  it('issues a profile link through the internal Profile API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'token-1', profileUrl: 'http://localhost:3000/profile/token-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(issueProfileLink('person-1', fetchMock, 'http://profile:3002')).resolves.toEqual({
      token: 'token-1',
      profileUrl: 'http://localhost:3000/profile/token-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://profile:3002/api/v1/internal/links',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('marks the Person as completed through PersonsService', async () => {
    const persons = {
      markProfileCompleted: vi.fn().mockResolvedValue({ isProfileCompleted: true }),
    };

    await expect(markProfileCompleted(persons as never, 'person-1')).resolves.toEqual({
      isProfileCompleted: true,
    });
  });
});
