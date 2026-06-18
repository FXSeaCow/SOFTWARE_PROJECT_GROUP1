import { apiClient } from "./apiClient";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
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

// The type shape returned by Joi validation / Controller ib backend
type BackendAuthResponse = {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      full_name: string;
      role: string;
    };
  };
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

  const response = await apiClient<BackendAuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });

  const session: AuthSession = {
    accessToken: response.data.accessToken,
    user: {
      id: response.data.user.id,
      email: response.data.user.email,
      name: response.data.user.full_name, // Mapping full_name -> name
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function register(payload: RegisterPayload): Promise<User> {
  const backendPayload = {
    full_name: payload.name,
    email: payload.email,
    password: payload.password,
    confirm_password: payload.confirm_password, 
  };

  const response = await apiClient<BackendAuthResponse>("/auth/register", {
    method: "POST",
    body: backendPayload,
  });

  return {
    id: response.data.user.id,
    email: response.data.user.email,
    name: response.data.user.full_name,
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
