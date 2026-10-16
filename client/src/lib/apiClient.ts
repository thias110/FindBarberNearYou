import type {
  AdminAuditLogsResponse,
  AdminBookingsResponse,
  AdminMetrics,
  AdminReview,
  AdminReviewsResponse,
  AdminUser,
  AdminUsersResponse,
  BarberReviewsResponse,
  BarbersSearchResponse,
  PopularTechniquesResponse,
  BarberStatsResponse,
  Booking,
  BookingCreateResponse,
  BarberPaymentSettings,
  BookingDetails,
  BookingsResponse,
  BookingSlotsResponse,
  OwnBarberPhoto,
  OwnBarberPhotosResponse,
  AddressSuggestion,
  OwnBarberProfile,
  ProfileCompletion,
  OwnBarberService,
  PublicBarberPhotosResponse,
  PublicBarberProfileWithServices,
  Notification,
  PublicReview,
  PublicUser,
  SiteConfigResponse,
  TimeOff,
  UnreadCountResponse,
  TimeOffResponse,
  WorkingHoursResponse,
} from "@findbarber/shared/types";
import {
  LIMITS,
  UPLOAD_IMAGE_MIME_TYPES,
  type AuditAction,
  type Locale,
  type BookingStatus,
  type ServicePlace,
} from "@findbarber/shared/constants";
import type {
  BookingCreateInput,
  PaymentSettingsInput,
  ProfileRequest,
  ReviewCreateInput,
  ServiceCreateInput,
  ServiceUpdateInput,
  TimeOffCreateInput,
  WorkingHoursInput,
} from "@findbarber/shared/validation";
import i18n from "../i18n";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Erreurs par champ d'un 400 VALIDATION_ERROR (issue #57). */
    public readonly fields: { path: string; message: string }[] = [],
  ) {
    // Message traduit selon le code (issue #33), sinon celui du serveur.
    super(translateErrorCode(code, message));
    this.name = "ApiError";
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const ACCEPTED_UPLOAD_TYPES = UPLOAD_IMAGE_MIME_TYPES as readonly string[];

/** Pré-validation client d'un fichier image (le serveur reste la référence). */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
    return "Format accepté : JPEG, PNG ou WebP.";
  }
  if (file.size > LIMITS.uploadMaxBytes) {
    return `Image trop volumineuse (${Math.round(
      LIMITS.uploadMaxBytes / 1_048_576,
    )} Mo maximum).`;
  }
  return null;
}

// Résout une URL publique d'upload (ex. `/uploads/avatars/<uuid>.webp`) vers
// l'origine de l'API. Les URLs absolues sont renvoyées telles quelles.
export function resolveUploadUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// Message d'erreur prêt à afficher. Les statuts 400/403/404/409/413 portent un
// message serveur explicite (français) ; 401 reçoit un message clair côté client.
// Les messages serveur sont en français ; ils sont traduits côté client à
// partir du code d'erreur (espace `errors`, issue #33). Sans traduction, le
// message du serveur s'affiche tel quel.
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return i18n.t("errors:SESSION_EXPIRED", {
        defaultValue: "Session expirée. Reconnectez-vous.",
      });
    }
    return err.message;
  }
  return err instanceof Error
    ? err.message
    : i18n.t("errors:UNKNOWN", { defaultValue: "Une erreur est survenue." });
}

// Un code renvoyé avec plusieurs messages serveur précis (ex.
// INVALID_STATUS_TRANSITION) vaut « {{serverMessage}} » en français : le
// message serveur, plus précis, est alors affiché tel quel.
export function translateErrorCode(code: string, fallback: string): string {
  return i18n.t(`errors:${code}`, {
    defaultValue: fallback,
    serverMessage: fallback,
  });
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => null)) as {
    error?: {
      code: string;
      message: string;
      fields?: { path: string; message: string }[];
    };
  } | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? "UNKNOWN",
      data?.error?.message ?? "Request failed.",
      Array.isArray(data?.error?.fields) ? data.error.fields : [],
    );
  }

  return data as T;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
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
    signal: options.signal,
  });

  return parseResponse<T>(res);
}

// Upload multipart : ne fixe JAMAIS `Content-Type` (le navigateur ajoute le
// boundary). Le jeton CSRF est posé dans l'en-tête comme pour `apiFetch`.
async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const headers: Record<string, string> = {};
  const csrf = readCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: formData,
  });

  return parseResponse<T>(res);
}

export interface AuthApi {
  me(): Promise<{ user: PublicUser }>;
  register(input: {
    email: string;
    password: string;
    role: "CLIENT" | "BARBER";
    name?: string;
    locale?: Locale;
  }): Promise<{ user: PublicUser }>;
  login(input: {
    email: string;
    password: string;
  }): Promise<{ user: PublicUser; csrfToken: string }>;
  logout(): Promise<void>;
  verifyEmail(input: { token: string }): Promise<{ verified: boolean }>;
  resendVerification(input: { email: string }): Promise<{ ok: boolean }>;
  forgotPassword(input: { email: string }): Promise<{ ok: boolean }>;
  resetPassword(input: {
    token: string;
    password: string;
  }): Promise<{ reset: boolean }>;
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
  verifyEmail: (input) =>
    apiFetch<{ verified: boolean }>("/api/auth/verify-email", {
      method: "POST",
      body: input,
    }),
  resendVerification: (input) =>
    apiFetch<{ ok: boolean }>("/api/auth/resend-verification", {
      method: "POST",
      body: input,
    }),
  forgotPassword: (input) =>
    apiFetch<{ ok: boolean }>("/api/auth/forgot-password", {
      method: "POST",
      body: input,
    }),
  resetPassword: (input) =>
    apiFetch<{ reset: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: input,
    }),
};

// Avatar générique de l'utilisateur connecté (issue #8).
// Configuration publique du site (issues #58, #59) : contact, réseaux, éditeur.
export const siteApi = {
  config: () => apiFetch<SiteConfigResponse>("/api/site-config"),
};

export interface UserApi {
  updateAvatar(file: File): Promise<{ user: PublicUser }>;
  deleteAvatar(): Promise<{ user: PublicUser }>;
  /** Export RGPD (issue #14) : objet JSON de toutes les données du compte. */
  exportData(): Promise<unknown>;
  updateLocale(locale: Locale): Promise<{ user: PublicUser }>;
  /** Suppression définitive (anonymisation), confirmée par le mot de passe. */
  deleteAccount(password: string): Promise<void>;
}

export const userApi: UserApi = {
  updateAvatar: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return apiUpload<{ user: PublicUser }>(
      "/api/users/me/avatar",
      formData,
      "PUT",
    );
  },
  deleteAvatar: () =>
    apiFetch<{ user: PublicUser }>("/api/users/me/avatar", { method: "DELETE" }),
  exportData: () => apiFetch<unknown>("/api/users/me/export"),
  updateLocale: (locale) =>
    apiFetch<{ user: PublicUser }>("/api/users/me/locale", {
      method: "PATCH",
      body: { locale },
    }),
  deleteAccount: (password) =>
    apiFetch<void>("/api/users/me", { method: "DELETE", body: { password } }),
};

// Notifications in-app (MVP) : lectures/mutations scopées côté serveur.
export interface NotificationApi {
  list(): Promise<{ notifications: Notification[] }>;
  unreadCount(): Promise<UnreadCountResponse>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export const notificationApi: NotificationApi = {
  list: () =>
    apiFetch<{ notifications: Notification[] }>("/api/notifications"),
  unreadCount: () =>
    apiFetch<UnreadCountResponse>("/api/notifications/unread-count"),
  markRead: (id) =>
    apiFetch<void>(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    }),
  markAllRead: () =>
    apiFetch<void>("/api/notifications/read-all", { method: "POST" }),
};

export interface BarberStatsParams {
  range?: "7d" | "30d" | "month" | "custom";
  from?: string;
  to?: string;
}

export interface BarberApi {
  getProfile(): Promise<{ profile: OwnBarberProfile }>;
  getProfileCompletion(): Promise<{ completion: ProfileCompletion }>;
  suggestAddresses(
    q: string,
    countryCode?: string,
    signal?: AbortSignal,
  ): Promise<{ suggestions: AddressSuggestion[] }>;
  getStats(params?: BarberStatsParams): Promise<BarberStatsResponse>;
  getPhotos(): Promise<OwnBarberPhotosResponse>;
  addPhoto(file: File, caption?: string): Promise<{ photo: OwnBarberPhoto }>;
  deletePhoto(photoId: string): Promise<void>;
  updateProfile(input: ProfileRequest): Promise<{ profile: OwnBarberProfile }>;
  getServices(): Promise<{ services: OwnBarberService[] }>;
  createService(input: ServiceCreateInput): Promise<{ service: OwnBarberService }>;
  updateService(
    serviceId: string,
    input: ServiceUpdateInput,
  ): Promise<{ service: OwnBarberService }>;
  getWorkingHours(): Promise<WorkingHoursResponse>;
  replaceWorkingHours(input: WorkingHoursInput): Promise<WorkingHoursResponse>;
  getTimeOff(): Promise<TimeOffResponse>;
  createTimeOff(input: TimeOffCreateInput): Promise<{ timeOff: TimeOff }>;
  deleteTimeOff(timeOffId: string): Promise<void>;
}

export const barberApi: BarberApi = {
  getProfile: () =>
    apiFetch<{ profile: OwnBarberProfile }>("/api/barber/profile"),
  getProfileCompletion: () =>
    apiFetch<{ completion: ProfileCompletion }>("/api/barber/profile/completion"),
  suggestAddresses: (q, countryCode, signal) =>
    apiFetch<{ suggestions: AddressSuggestion[] }>(
      `/api/barber/address-suggestions${toQueryString({ q, countryCode })}`,
      { signal },
    ),
  getStats: (params) => {
    const sp = new URLSearchParams();
    if (params?.range !== undefined) sp.set("range", params.range);
    if (params?.from !== undefined) sp.set("from", params.from);
    if (params?.to !== undefined) sp.set("to", params.to);
    const qs = sp.toString();
    return apiFetch<BarberStatsResponse>(
      `/api/barber/stats${qs ? `?${qs}` : ""}`,
    );
  },
  getPhotos: () => apiFetch<OwnBarberPhotosResponse>("/api/barber/photos"),
  addPhoto: (file, caption) => {
    const formData = new FormData();
    formData.append("image", file);
    const trimmed = caption?.trim();
    if (trimmed) formData.append("caption", trimmed);
    return apiUpload<{ photo: OwnBarberPhoto }>("/api/barber/photos", formData);
  },
  deletePhoto: (photoId) =>
    apiFetch<void>(`/api/barber/photos/${encodeURIComponent(photoId)}`, {
      method: "DELETE",
    }),
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
  getWorkingHours: () =>
    apiFetch<WorkingHoursResponse>("/api/barber/working-hours"),
  replaceWorkingHours: (input) =>
    apiFetch<WorkingHoursResponse>("/api/barber/working-hours", {
      method: "PUT",
      body: input,
    }),
  getTimeOff: () =>
    apiFetch<TimeOffResponse>("/api/barber/time-off"),
  createTimeOff: (input) =>
    apiFetch<{ timeOff: TimeOff }>("/api/barber/time-off", {
      method: "POST",
      body: input,
    }),
  // `apiFetch` court-circuite le parsing JSON sur 204 et renvoie `undefined`.
  deleteTimeOff: (timeOffId) =>
    apiFetch<void>(`/api/barber/time-off/${encodeURIComponent(timeOffId)}`, {
      method: "DELETE",
    }),
};

function toQueryString(params: object = {}): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export interface AdminUsersParams {
  role?: "CLIENT" | "BARBER" | "ADMIN";
  // Profils barber en attente d'approbation uniquement (issue #40).
  pendingApproval?: "true";
  page?: number;
  pageSize?: number;
}

export interface AdminBookingsParams {
  status?: BookingStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminReviewsParams {
  page?: number;
  pageSize?: number;
}

export interface AdminAuditLogsParams {
  action?: AuditAction;
  page?: number;
  pageSize?: number;
}

export interface AdminApi {
  getMetrics(): Promise<AdminMetrics>;
  listUsers(params?: AdminUsersParams): Promise<AdminUsersResponse>;
  suspendUser(userId: string): Promise<{ user: AdminUser }>;
  reactivateUser(userId: string): Promise<{ user: AdminUser }>;
  certifyBarber(barberProfileId: string): Promise<{ user: AdminUser }>;
  uncertifyBarber(barberProfileId: string): Promise<{ user: AdminUser }>;
  approveBarber(barberProfileId: string): Promise<{ user: AdminUser }>;
  listBookings(params?: AdminBookingsParams): Promise<AdminBookingsResponse>;
  cancelBooking(bookingId: string): Promise<{ booking: Booking }>;
  listReviews(params?: AdminReviewsParams): Promise<AdminReviewsResponse>;
  hideReview(reviewId: string): Promise<{ review: AdminReview }>;
  listAuditLogs(params?: AdminAuditLogsParams): Promise<AdminAuditLogsResponse>;
  getBarberStats(
    barberId: string,
    params?: BarberStatsParams,
  ): Promise<BarberStatsResponse>;
}

export const adminApi: AdminApi = {
  getMetrics: () => apiFetch<AdminMetrics>("/api/admin/metrics"),
  listUsers: (params) =>
    apiFetch<AdminUsersResponse>(`/api/admin/users${toQueryString(params)}`),
  suspendUser: (userId) =>
    apiFetch<{ user: AdminUser }>(
      `/api/admin/users/${encodeURIComponent(userId)}/suspend`,
      { method: "POST" },
    ),
  reactivateUser: (userId) =>
    apiFetch<{ user: AdminUser }>(
      `/api/admin/users/${encodeURIComponent(userId)}/reactivate`,
      { method: "POST" },
    ),
  certifyBarber: (barberProfileId) =>
    apiFetch<{ user: AdminUser }>(
      `/api/admin/barbers/${encodeURIComponent(barberProfileId)}/certify`,
      { method: "POST" },
    ),
  uncertifyBarber: (barberProfileId) =>
    apiFetch<{ user: AdminUser }>(
      `/api/admin/barbers/${encodeURIComponent(barberProfileId)}/uncertify`,
      { method: "POST" },
    ),
  approveBarber: (barberProfileId) =>
    apiFetch<{ user: AdminUser }>(
      `/api/admin/barbers/${encodeURIComponent(barberProfileId)}/approve`,
      { method: "POST" },
    ),
  listBookings: (params) =>
    apiFetch<AdminBookingsResponse>(
      `/api/admin/bookings${toQueryString(params)}`,
    ),
  cancelBooking: (bookingId) =>
    apiFetch<{ booking: Booking }>(
      `/api/admin/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST" },
    ),
  listReviews: (params) =>
    apiFetch<AdminReviewsResponse>(
      `/api/admin/reviews${toQueryString(params)}`,
    ),
  hideReview: (reviewId) =>
    apiFetch<{ review: AdminReview }>(
      `/api/admin/reviews/${encodeURIComponent(reviewId)}/hide`,
      { method: "POST" },
    ),
  listAuditLogs: (params) =>
    apiFetch<AdminAuditLogsResponse>(
      `/api/admin/audit-logs${toQueryString(params)}`,
    ),
  getBarberStats: (barberId, params) =>
    apiFetch<BarberStatsResponse>(
      `/api/admin/barbers/${encodeURIComponent(barberId)}/stats${toQueryString(params)}`,
    ),
};

export interface BarbersSearchParams {
  q?: string;
  city?: string;
  countryCode?: string;
  audience?: string;
  technique?: string;
  place?: string;
  page?: number;
  pageSize?: number;
  // Filtres « intelligents » (issue #52) : prix maximum en unités majeures
  // dans `currency`, note minimale de 1 à 5.
  maxPrice?: number;
  currency?: string;
  minRating?: number;
  // Zone géographique (issues #50 et #52), jamais la position du visiteur.
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

export interface PublicBarbersApi {
  getProfile(barberId: string): Promise<PublicBarberProfileWithServices>;
  getPhotos(barberId: string): Promise<PublicBarberPhotosResponse>;
  getSlots(
    barberId: string,
    params: { serviceId: string; date: string; place: ServicePlace },
    signal?: AbortSignal,
  ): Promise<BookingSlotsResponse>;
  getReviews(
    barberId: string,
    params?: { page?: number; pageSize?: number },
  ): Promise<BarberReviewsResponse>;
  search(
    params: BarbersSearchParams,
    signal?: AbortSignal,
  ): Promise<BarbersSearchResponse>;
  popularTechniques(signal?: AbortSignal): Promise<PopularTechniquesResponse>;
}

export const barbersApi: PublicBarbersApi = {
  getProfile: (barberId) =>
    apiFetch<PublicBarberProfileWithServices>(
      `/api/barbers/${encodeURIComponent(barberId)}`,
    ),
  getPhotos: (barberId) =>
    apiFetch<PublicBarberPhotosResponse>(
      `/api/barbers/${encodeURIComponent(barberId)}/photos`,
    ),
  getSlots: (barberId, params, signal) => {
    const sp = new URLSearchParams({
      serviceId: params.serviceId,
      date: params.date,
      place: params.place,
    });
    return apiFetch<BookingSlotsResponse>(
      `/api/barbers/${encodeURIComponent(barberId)}/slots?${sp.toString()}`,
      { signal },
    );
  },
  getReviews: (barberId, params) => {
    const sp = new URLSearchParams();
    if (params?.page !== undefined) sp.set("page", String(params.page));
    if (params?.pageSize !== undefined) {
      sp.set("pageSize", String(params.pageSize));
    }
    const qs = sp.toString();
    return apiFetch<BarberReviewsResponse>(
      `/api/barbers/${encodeURIComponent(barberId)}/reviews${qs ? `?${qs}` : ""}`,
    );
  },
  search: (params, signal) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        sp.set(key, String(value));
      }
    }
    const qs = sp.toString();
    return apiFetch<BarbersSearchResponse>(
      `/api/barbers${qs ? `?${qs}` : ""}`,
      { signal },
    );
  },
  popularTechniques: (signal) =>
    apiFetch<PopularTechniquesResponse>("/api/barbers/popular-techniques", {
      signal,
    }),
};

export interface BookingApi {
  create(input: BookingCreateInput): Promise<BookingCreateResponse>;
  list(): Promise<BookingsResponse>;
  getDetails(bookingId: string): Promise<{ booking: BookingDetails }>;
  confirm(bookingId: string): Promise<{ booking: Booking }>;
  decline(bookingId: string, reason: string): Promise<{ booking: Booking }>;
  complete(bookingId: string): Promise<{ booking: Booking }>;
  cancel(bookingId: string): Promise<{ booking: Booking }>;
  createReview(
    bookingId: string,
    input: ReviewCreateInput,
  ): Promise<{ review: PublicReview }>;
}

export const bookingApi: BookingApi = {
  create: (input) =>
    apiFetch<BookingCreateResponse>("/api/bookings", {
      method: "POST",
      body: input,
    }),
  list: () => apiFetch<BookingsResponse>("/api/bookings"),
  getDetails: (bookingId) =>
    apiFetch<{ booking: BookingDetails }>(
      `/api/bookings/${encodeURIComponent(bookingId)}`,
    ),
  confirm: (bookingId) =>
    apiFetch<{ booking: Booking }>(
      `/api/bookings/${encodeURIComponent(bookingId)}/confirm`,
      { method: "POST" },
    ),
  decline: (bookingId, reason) =>
    apiFetch<{ booking: Booking }>(
      `/api/bookings/${encodeURIComponent(bookingId)}/decline`,
      { method: "POST", body: reason.trim() ? { reason: reason.trim() } : {} },
    ),
  complete: (bookingId) =>
    apiFetch<{ booking: Booking }>(
      `/api/bookings/${encodeURIComponent(bookingId)}/complete`,
      { method: "POST" },
    ),
  cancel: (bookingId) =>
    apiFetch<{ booking: Booking }>(
      `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST" },
    ),
  createReview: (bookingId, input) =>
    apiFetch<{ review: PublicReview }>(
      `/api/bookings/${encodeURIComponent(bookingId)}/review`,
      { method: "POST", body: input },
    ),
};

// Paiement en ligne côté barber (issue #10, Stripe Connect).
export interface BarberPaymentsApi {
  get(): Promise<{ settings: BarberPaymentSettings }>;
  update(input: PaymentSettingsInput): Promise<{ settings: BarberPaymentSettings }>;
  /** Lien d'inscription Stripe (création du compte au premier appel). */
  onboarding(): Promise<{ url: string }>;
}

export const barberPaymentsApi: BarberPaymentsApi = {
  get: () => apiFetch<{ settings: BarberPaymentSettings }>("/api/barber/payments"),
  update: (input) =>
    apiFetch<{ settings: BarberPaymentSettings }>("/api/barber/payments", {
      method: "PUT",
      body: input,
    }),
  onboarding: () =>
    apiFetch<{ url: string }>("/api/barber/payments/onboarding", { method: "POST" }),
};
