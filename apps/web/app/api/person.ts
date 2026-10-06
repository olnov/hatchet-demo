const API_BASE_URL =
  process.env.NEXT_PUBLIC_PERSON_API_URL ?? 'http://localhost:3001/api/v1';

export type Registration = {
  personId: string;
  email: string;
  runId: string;
};

export type RegistrationStatus =
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'completed' }
  | { status: 'linkReady'; profileUrl: string };

export async function registerPerson(data: {
  email: string;
  password: string;
}) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(`${API_BASE_URL}/register`, requestOptions);
    if (!response.ok) throw new Error(`Registration failed. Error status: ${response.status}`);
    return response.json() as Promise<Registration>;
  } catch (error) {
    console.error('Error creating person:', error);
    throw error;
  }
}

export async function getRegistrationStatus(
  runId: string,
): Promise<RegistrationStatus> {
  const response = await fetch(`${API_BASE_URL}/registrations/${runId}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Could not get registration status: ${response.status}`);
  }

  return response.json() as Promise<RegistrationStatus>;
}

export async function getPerson(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/persons/${id}`);
    return response.json();
  } catch (error) {
    console.error('Error fetching person:', error);
    throw error;
  }
}

export async function updatePerson(
  id: string,
  data: { isProfileCompleted: boolean },
) {
  const requestOptions = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(
      `${API_BASE_URL}/persons/${id}/profile-completed`,
      { ...requestOptions, method: 'PATCH' },
    );
    return response.json();
  } catch (error) {
    console.error('Error updating person:', error);
    throw error;
  }
}
