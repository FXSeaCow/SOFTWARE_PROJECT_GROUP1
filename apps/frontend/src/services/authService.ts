type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
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
const USERS_STORAGE_KEY = "gym-web.users";

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

  const users = getStoredUsers();
  const matchedUser = users.find(
    (user) =>
      user.email.toLowerCase() === payload.email.toLowerCase() &&
      user.password === payload.password,
  );

  if (!matchedUser) {
    throw new Error("Email or password is incorrect");
  }

  const session: AuthSession = {
    accessToken: `token-${matchedUser.id}`,
    user: {
      id: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function register(payload: RegisterPayload): Promise<User> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));

  const users = getStoredUsers();
  const email = payload.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Email is already registered");
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: payload.name.trim(),
    email,
    password: payload.password,
  };

  users.push(newUser);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
  };
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

type StoredUser = User & {
  password: string;
};

function getStoredUsers(): StoredUser[] {
  const raw = localStorage.getItem(USERS_STORAGE_KEY);

  if (!raw) {
    return [
      {
        ...demoUser.user,
        password: "123456",
      },
    ];
  }

  try {
    const users = JSON.parse(raw) as StoredUser[];
    return users.length > 0
      ? users
      : [
          {
            ...demoUser.user,
            password: "123456",
          },
        ];
  } catch {
    localStorage.removeItem(USERS_STORAGE_KEY);
    return [
      {
        ...demoUser.user,
        password: "123456",
      },
    ];
  }
}
