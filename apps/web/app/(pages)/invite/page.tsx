'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type LinkResponse = { profileUrl: string };

export default function Invite() {
  const searchParams = useSearchParams();
  const personId = searchParams.get('personId');
  const [profileUrl, setProfileUrl] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!personId) return;

    const profileApi = process.env.NEXT_PUBLIC_PROFILE_API_URL ?? 'http://localhost:3002/api/v1';
    fetch(`${profileApi}/internal/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personId }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось создать инвайт.');
        return response.json() as Promise<LinkResponse>;
      })
      .then(({ profileUrl: url }) => setProfileUrl(url))
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Не удалось создать инвайт.'),
      );
  }, [personId]);

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-neutral-900 shadow-sm">
        <h1 className="text-2xl font-semibold">Ваш инвайт</h1>
        {!profileUrl && !error && <p className="mt-3">Создаём ссылку для заполнения профиля…</p>}
        {!personId && <p className="mt-3 text-red-700">Сначала зарегистрируйтесь.</p>}
        {error && <p className="mt-3 text-red-700">{error}</p>}
        {profileUrl && (
          <Link className="mt-4 inline-block text-amber-700 underline" href={profileUrl}>
            Перейти к заполнению профиля
          </Link>
        )}
      </section>
    </main>
  );
}
