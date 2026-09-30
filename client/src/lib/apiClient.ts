import type {
  OwnBarberProfile,
  OwnBarberService,
  PublicBarberProfileWithServices,
  PublicUser,
} from "@findbarber/shared/types";
import type {
  ProfileInput,
  ServiceCreateInput,
  ServiceUpdateInput,
} from "@findbarber/shared/validation";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...options.headers };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(
    method.toUpperCase(),
  );
  if (mutating) {
    const csrf = readCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string };
  } | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? "UNKNOWN",
      data?.error?.message ?? "Request failed.",
    );
  }

  return data as T;
}

export interface AuthApi {
  me(): Promise<{ user: PublicUser }>;
  register(input: {
    email: string;
    password: string;
    role: "CLIENT" | "BARBER";
    name?: string;
  }): Promise<{ user: PublicUser }>;
  login(input: {
    email: string;
    password: string;
  }): Promise<{ user: PublicUser; csrfToken: string }>;
  logout(): Promise<void>;
}

export const authApi: AuthApi = {
  me: () => apiFetch<{ user: PublicUser }>("/api/auth/me"),
  register: (input) =>
    apiFetch<{ user: PublicUser }>("/api/auth/register", {
      method: "POST",
      body: input,
    }),
  login: (input) =>
    apiFetch<{ user: PublicUser; csrfToken: string }>("/api/auth/login", {
      method: "POST",
      body: input,
    }),
  logout: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),
};

export interface BarberApi {
  getProfile(): Promise<{ profile: OwnBarberProfile }>;
  updateProfile(input: ProfileInput): Promise<{ profile: OwnBarberProfile }>;
  getServices(): Promise<{ services: OwnBarberService[] }>;
  createService(input: ServiceCreateInput): Promise<{ service: OwnBarberService }>;
  updateService(
    serviceId: string,
    input: ServiceUpdateInput,
  ): Promise<{ service: OwnBarberService }>;
}

export const barberApi: BarberApi = {
  getProfile: () =>
    apiFetch<{ profile: OwnBarberProfile }>("/api/barber/profile"),
  updateProfile: (input) =>
    apiFetch<{ profile: OwnBarberProfile }>("/api/barber/profile", {
      method: "PUT",
      body: input,
    }),
  getServices: () =>
    apiFetch<{ services: OwnBarberService[] }>("/api/barber/services"),
  createService: (input) =>
    apiFetch<{ service: OwnBarberService }>("/api/barber/services", {
      method: "POST",
      body: input,
    }),
  updateService: (serviceId, input) =>
    apiFetch<{ service: OwnBarberService }>(
      `/api/barber/services/${encodeURIComponent(serviceId)}`,
      { method: "PATCH", body: input },
    ),
};

export interface PublicBarbersApi {
  getProfile(barberId: string): Promise<PublicBarberProfileWithServices>;
}

export const barbersApi: PublicBarbersApi = {
  getProfile: (barberId) =>
    apiFetch<PublicBarberProfileWithServices>(
      `/api/barbers/${encodeURIComponent(barberId)}`,
    ),
};
