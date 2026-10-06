const PROFILE_API_BASE =
  process.env.NEXT_PUBLIC_PROFILE_API_URL ?? 'http://localhost:3002/api/v1';

export type ProfileLink = { personId: string; expiresAt: string };
export type ProfileInput = {
  firstName: string;
  lastName: string;
  personalStatement: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PROFILE_API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(response.status === 410 ? 'Ссылка истекла или уже использована.' : 'Не удалось загрузить профиль.');
  }
  return response.json() as Promise<T>;
}

export function getProfileLink(token: string): Promise<ProfileLink> {
  return request<ProfileLink>(`/profiles/${token}`);
}

export function submitProfile(token: string, input: ProfileInput) {
  return request<{ profileId: string; personId: string }>(`/profiles/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}
