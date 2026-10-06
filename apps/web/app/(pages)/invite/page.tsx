'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  getRegistrationStatus,
  type RegistrationStatus,
} from '@/app/api/person';

export function shouldPollRegistration(status?: RegistrationStatus) {
  return (
    status?.status !== 'linkReady' &&
    status?.status !== 'failed' &&
    status?.status !== 'completed'
  );
}

export default function Invite() {
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');
  const [registration, setRegistration] = useState<RegistrationStatus>();
  const [error, setError] = useState<string>();
  const shouldPoll = shouldPollRegistration(registration);

  useEffect(() => {
    if (!runId || !shouldPoll) return;

    let active = true;

    const loadStatus = async () => {
      try {
        const status = await getRegistrationStatus(runId);
        if (active) setRegistration(status);
      } catch {
        if (active) setError('Не удалось получить статус онбординга.');
      }
    };

    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 1_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [runId, shouldPoll]);

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-6 text-neutral-900 shadow-sm">
        <h1 className="text-2xl font-semibold">Ваш инвайт</h1>
        {runId ? (
          <>
            <p className="mt-2 text-sm text-neutral-600">Номер запуска: {runId}</p>
            {!registration || registration.status === 'pending' ? (
              <p className="mt-3">Создаём ссылку для заполнения профиля…</p>
            ) : null}
            {registration?.status === 'linkReady' ? (
              <Link
                className="mt-4 inline-block text-amber-700 underline"
                href={registration.profileUrl}
              >
                Перейти к заполнению профиля
              </Link>
            ) : null}
            {registration?.status === 'failed' ? (
              <p className="mt-3 text-red-700">Не удалось создать инвайт.</p>
            ) : null}
            {registration?.status === 'completed' ? (
              <p className="mt-3 text-green-700">Профиль заполнен.</p>
            ) : null}
            {error ? <p className="mt-3 text-red-700">{error}</p> : null}
          </>
        ) : (
          <p className="mt-3 text-red-700">Сначала зарегистрируйтесь.</p>
        )}
      </section>
    </main>
  );
}
