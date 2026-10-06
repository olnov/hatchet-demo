'use client';

import { registerPerson } from '@/app/api/person';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Person() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const registration = await registerPerson({ email, password });
      router.push(`/invite?runId=${registration.runId}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error creating person:', error);
        alert(`Не удалось зарегистрироваться: ${error.message}`);
      }
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 text-neutral-900 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">Registration</h1>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-amber-600"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-amber-600"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
          type="submit"
        >
          Register
        </button>
      </form>
    </main>
  );
}
