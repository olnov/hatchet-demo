import { afterEach, describe, expect, it, vi } from 'vitest';

import { getProfileLink } from './profile';

describe('getProfileLink', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns active-link metadata from the Profile API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ personId: 'person-1', expiresAt: '2026-10-01T00:00:00.000Z' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(getProfileLink('active-token')).resolves.toEqual({
      personId: 'person-1',
      expiresAt: '2026-10-01T00:00:00.000Z',
    });
  });
});
