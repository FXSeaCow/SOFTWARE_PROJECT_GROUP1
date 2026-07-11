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

export type User = {
  id: string;
  email: string;
  name: string;
  role?: "member" | "admin";
};

type AuthSession = {
  accessToken: string;
  user: User;
};

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
      name: response.data.user.full_name,
      role: response.data.user.role as User["role"],
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function register(payload: RegisterPayload): Promise<User> {
  const response = await apiClient<BackendAuthResponse>("/auth/register", {
    method: "POST",
    body: {
      full_name: payload.name,
      email: payload.email,
      password: payload.password,
      confirm_password: payload.confirm_password,
    },
  });

  return {
    id: response.data.user.id,
    email: response.data.user.email,
    name: response.data.user.full_name,
    role: response.data.user.role as User["role"],
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
