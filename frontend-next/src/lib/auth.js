import { apiRequest, buildAuthHeaders } from "@/lib/api-client";

const AUTH_STORAGE_KEY = "luminalib_auth_session";
const AUTH_CHANGE_EVENT = "luminalib-auth-change";

function dispatchAuthChange() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
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
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
