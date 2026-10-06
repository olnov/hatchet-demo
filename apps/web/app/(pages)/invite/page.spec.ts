import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('runId=run-123'),
}));

import Invite, { shouldPollRegistration } from './page';

describe('Invite', () => {
  it('stops polling after a terminal registration status', () => {
    expect(shouldPollRegistration()).toBe(true);
    expect(shouldPollRegistration({ status: 'pending' })).toBe(true);
    expect(shouldPollRegistration({ status: 'linkReady', profileUrl: 'http://localhost/profile/token' })).toBe(false);
    expect(shouldPollRegistration({ status: 'failed' })).toBe(false);
    expect(shouldPollRegistration({ status: 'completed' })).toBe(false);
  });

  it('shows the workflow run started by registration', () => {
    const page = renderToStaticMarkup(createElement(Invite));

    expect(page).toContain('Создаём ссылку для заполнения профиля…');
    expect(page).toContain('run-123');
  });
});
