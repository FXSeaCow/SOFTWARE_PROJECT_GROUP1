const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "/api";

const STORAGE_KEY = "gym-web.auth-session";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

type StoredSession = {
  accessToken?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  };
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isJwtLike(value: string): boolean {
  return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value);
}

function isValidStoredSession(session: unknown): session is StoredSession {
  if (!session || typeof session !== "object") {
    return false;
  }

  const candidate = session as StoredSession;
  return (
    typeof candidate.accessToken === "string" &&
    isJwtLike(candidate.accessToken) &&
    !!candidate.user &&
    typeof candidate.user.id === "string" &&
    isUuid(candidate.user.id)
  );
}

function getStoredSession(): StoredSession | null {
  const rawSession = localStorage.getItem(STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as unknown;
    if (!isValidStoredSession(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function setStoredAccessToken(accessToken: string) {
  const session = getStoredSession();
  if (!session) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...session,
      accessToken,
    }),
  );
}

async function refreshAccessToken(): Promise<string> {
  const refreshUrl = `${API_BASE_URL}/auth/refresh-token`;
  const response = await fetch(refreshUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
  });

  const rawBody = await response.text();
  let parsed: { data?: { accessToken?: string }; message?: string } | null = null;

  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody) as { data?: { accessToken?: string }; message?: string };
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed?.data?.accessToken) {
    const backendMessage = parsed?.message?.trim();

    if (
      backendMessage === "Invalid ID format — must be a valid UUID" ||
      backendMessage === "Invalid ID format â€” must be a valid UUID" ||
      backendMessage === "Invalid refresh token" ||
      backendMessage === "Refresh token expired — please log in again" ||
      backendMessage === "Refresh token expired â€” please log in again" ||
      backendMessage === "Account no longer exists"
    ) {
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(backendMessage || "Session expired. Please log in again.");
  }

  setStoredAccessToken(parsed.data.accessToken);
  return parsed.data.accessToken;
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${normalizedEndpoint}`;

  async function sendRequest(accessTokenOverride?: string): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const session = getStoredSession();
    const accessToken = accessTokenOverride || session?.accessToken;
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
    });

    const rawBody = await response.text();
    let data: (T | { message?: string } | null) = null;

    if (rawBody) {
      try {
        data = JSON.parse(rawBody) as T | { message?: string };
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const messageFromJson =
        data && typeof data === "object" && "message" in data && typeof data.message === "string"
          ? data.message
          : null;
      const messageFromText = rawBody && !messageFromJson ? rawBody : null;

      throw new Error(
        messageFromJson ||
          messageFromText ||
          `Request failed (${response.status} ${response.statusText})`,
      );
    }

    return data as T;
  }

  try {
    return await sendRequest();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Access token expired") {
      throw error;
    }

    try {
      const nextAccessToken = await refreshAccessToken();
      return await sendRequest(nextAccessToken);
    } catch (refreshError) {
      localStorage.removeItem(STORAGE_KEY);
      throw refreshError;
    }
  }
}
