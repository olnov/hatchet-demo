import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRegistrationStatus } from './person';

describe('getRegistrationStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gets the profile URL produced by the onboarding workflow', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'linkReady',
          profileUrl: 'http://localhost:3000/profile/token-1',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getRegistrationStatus('run-1')).resolves.toEqual({
      status: 'linkReady',
      profileUrl: 'http://localhost:3000/profile/token-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/registrations/run-1',
      { cache: 'no-store' },
    );
  });
});
