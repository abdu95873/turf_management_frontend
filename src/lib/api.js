export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

let unauthorizedHandler = null;
let tokenRefreshHandler = null;
let refreshPromise = null;

const PUBLIC_AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh"];

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function setTokenRefreshHandler(handler) {
  tokenRefreshHandler = handler;
}

export function getStoredAccessToken() {
  return localStorage.getItem("tm_token")?.trim() ?? "";
}

export function getStoredRefreshToken() {
  return localStorage.getItem("tm_refresh_token")?.trim() ?? "";
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function authHeaders(token) {
  const accessToken = token || getStoredAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function normalizeAuthUser(raw) {
  if (!raw) return null;
  const id = raw.id ?? raw._id;
  if (!id) return null;
  return {
    id: String(id),
    name: raw.name ?? "",
    email: raw.email ?? "",
    role: raw.role ?? "user",
    ownerId: raw.ownerId ? String(raw.ownerId) : undefined,
  };
}

function formatValidationMessage(message) {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return null;
  const fieldErrors = message.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const first = Object.values(fieldErrors).flat().find(Boolean);
    if (first) return String(first);
  }
  const formErrors = message.formErrors;
  if (Array.isArray(formErrors) && formErrors[0]) return String(formErrors[0]);
  return null;
}

export function formatApiError(error) {
  if (typeof error?.message === "string" && error.name === "ApiError") return error.message;
  if (typeof error?.message === "string") return error.message;
  const fromData = formatValidationMessage(error?.data?.message);
  if (fromData) return fromData;
  if (typeof error?.data?.message === "string") return error.data.message;
  return "Request failed";
}

export function getBookingAuthMessage(error) {
  if (error?.status === 403) {
    return "Only customer accounts can book venues. Please log in with a user account.";
  }
  if (error?.status === 401) {
    return "Your session expired. Please log in again.";
  }
  return formatApiError(error);
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      let res;
      try {
        res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        return null;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.accessToken) {
        return null;
      }

      localStorage.setItem("tm_token", data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem("tm_refresh_token", data.refreshToken);
      }
      const user = normalizeAuthUser(data.user);
      if (user) {
        localStorage.setItem("tm_user", JSON.stringify(user));
      }
      tokenRefreshHandler?.({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
        user,
      });
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function mergeAuthHeaders(init) {
  const headers = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  const hasAuthHeader = Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
  if (!hasAuthHeader) {
    return { ...headers, ...authHeaders() };
  }
  return headers;
}

export async function api(path, init, options = {}) {
  const { retryOnUnauthorized = true } = options;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: mergeAuthHeaders(init),
    });
  } catch {
    throw new ApiError("Cannot reach server. Is the backend running on port 5000?", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : data?.message
          ? JSON.stringify(data.message)
          : `Request failed (${res.status})`;
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((publicPath) => path.startsWith(publicPath));

    if (res.status === 401 && !isPublicAuth) {
      if (retryOnUnauthorized) {
        const refreshed = await refreshAccessToken();
        if (refreshed?.accessToken) {
          const retryHeaders = {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${refreshed.accessToken}`,
          };
          return api(path, { ...init, headers: retryHeaders }, { retryOnUnauthorized: false });
        }
      }
      unauthorizedHandler?.();
    }
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export function getStoredUser() {
  const raw = localStorage.getItem("tm_user");
  if (!raw) return null;
  try {
    return normalizeAuthUser(JSON.parse(raw));
  } catch {
    localStorage.removeItem("tm_user");
    return null;
  }
}

export function redirectByRole(role) {
  if (role === "owner") return "/owner";
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/account/bookings";
}

export function isDashboardRole(role) {
  return role === "owner" || role === "staff" || role === "admin";
}
