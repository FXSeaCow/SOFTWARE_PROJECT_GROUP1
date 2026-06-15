type LoginPayload = {
  email: string;
  password: string;
};

type User = {
  id: string;
  email: string;
  name: string;
};

type AuthSession = {
  accessToken: string;
  user: User;
};

const STORAGE_KEY = "gym-web.auth-session";

const demoUser: AuthSession = {
  accessToken: "demo-token",
  user: {
    id: "user-1",
    email: "member@gym.com",
    name: "Demo Member",
  },
};

export async function login(payload: LoginPayload): Promise<AuthSession> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));

  if (
    payload.email.toLowerCase() !== demoUser.user.email ||
    payload.password !== "123456"
  ) {
    throw new Error("Email or password is incorrect");
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
  return demoUser;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUser(): User | null {
  const session = getSession();
  return session?.user ?? null;
}

export function getAccessToken(): string | null {
  const session = getSession();
  return session?.accessToken ?? null;
}

function getSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
