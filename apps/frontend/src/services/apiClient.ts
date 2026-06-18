const API_BASE_URL = "http://localhost:3000/api";

const STORAGE_KEY = "gym-web.auth-session";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  // 1. Build the dynamic headers object
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 2. Automatically grab the token from localStorage if it exists
  const rawSession = localStorage.getItem(STORAGE_KEY);
  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      if (session?.accessToken) {
        // Automatically inject the Bearer token for your backend's authenticate middleware!
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }
    } catch {
      // Clear corrupted session if parsing fails
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // 3. Make the fetch request to the backend url
  // Ensure the endpoint has a leading slash if missing
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as T | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      (data && typeof data === "object" && "message" in data && data.message) ||
        "Request failed",
    );
  }

  return data as T;
}
