import { apiRequest, buildAuthHeaders } from "@/lib/api-client";

const AUTH_STORAGE_KEY = "luminalib_auth_session";
const AUTH_CHANGE_EVENT = "luminalib-auth-change";
export const AUTH_ACCESS_TOKEN_COOKIE_KEY = "luminalib_access_token";
const AUTH_ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function dispatchAuthChange() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function setAccessTokenCookie(accessToken) {
  if (typeof document === "undefined") {
    return;
  }

  const secureFlag = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = [
    `${AUTH_ACCESS_TOKEN_COOKIE_KEY}=${encodeURIComponent(accessToken)}`,
    "Path=/",
    `Max-Age=${AUTH_ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    secureFlag,
  ].join("; ");
}

function clearAccessTokenCookie() {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${AUTH_ACCESS_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function signupUser(credentials) {
  return apiRequest("/v1/auth/signup", {
    method: "POST",
    body: credentials,
  });
}

export async function loginUser(credentials) {
  const payload = await apiRequest("/v1/auth/login", {
    method: "POST",
    body: credentials,
  });
  return payload?.data || null;
}

export async function logoutUser(accessToken) {
  return apiRequest("/v1/auth/logout", {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });
}

export function persistAuthSession(loginData) {
  if (typeof window === "undefined" || !loginData) {
    return;
  }

  const session = {
    user: loginData.user || null,
    token: loginData.token || null,
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  if (session?.token?.access_token) {
    setAccessTokenCookie(session.token.access_token);
  }
  dispatchAuthChange();
}

export function readAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    clearAccessTokenCookie();
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  clearAccessTokenCookie();
  dispatchAuthChange();
}

export function subscribeAuthChange(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
}
