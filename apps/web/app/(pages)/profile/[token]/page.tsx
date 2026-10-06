'use client';

import { getProfileLink, submitProfile } from '@/app/api/profile';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    getProfileLink(token)
      .then(() => setReady(true))
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить профиль.'),
      );
  }, [token]);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await submitProfile(token, {
        firstName: String(form.get('firstName') ?? ''),
        lastName: String(form.get('lastName') ?? ''),
        personalStatement: String(form.get('personalStatement') ?? ''),
      });
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить профиль.');
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-neutral-900 shadow-sm">
        <h1 className="text-2xl font-semibold">Ваш профиль</h1>
        {error && <p className="mt-3 text-red-700">{error}</p>}
        {saved && <p className="mt-3 text-green-700">Профиль сохранён.</p>}
        {ready && !saved && !error && (
          <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
            <label>Имя<input className="ml-2 rounded border p-2" name="firstName" required maxLength={30} /></label>
            <label>Фамилия<input className="ml-2 rounded border p-2" name="lastName" required maxLength={30} /></label>
            <label className="flex flex-col gap-2">О себе<textarea className="rounded border p-2" name="personalStatement" required maxLength={1500} /></label>
            <button className="rounded bg-amber-600 px-4 py-2 text-white" type="submit">Сохранить профиль</button>
          </form>
        )}
        {!ready && !error && <p className="mt-3">Проверяем ссылку…</p>}
      </section>
    </main>
  );
}
