import {
  AUTH_ACCESS_TOKEN_COOKIE_KEY,
  clearAuthSession,
  loginUser,
  logoutUser,
  persistAuthSession,
  readAuthSession,
  signupUser,
  subscribeAuthChange,
} from "@/lib/auth";
import { apiRequest, buildAuthHeaders } from "@/lib/api-client";

function getAccessToken(session) {
  return session?.token?.access_token || "";
}

const SESSION_VALIDATE_TIMEOUT_MS = 8000;

function readAccessTokenCookie() {
  if (typeof document === "undefined") {
    return "";
  }

  const cookiePrefix = `${AUTH_ACCESS_TOKEN_COOKIE_KEY}=`;
  const cookieEntry = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(cookiePrefix));

  if (!cookieEntry) {
    return "";
  }

  const rawValue = cookieEntry.slice(cookiePrefix.length);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function getSession() {
  return readAuthSession();
}

export function subscribeSessionChange(callback) {
  return subscribeAuthChange(callback);
}

export function isAuthenticated() {
  const session = getSession();
  return Boolean(getAccessToken(session));
}

export async function validateSession() {
  const session = getSession();
  const accessToken = getAccessToken(session);
  if (!accessToken) {
    return false;
  }

  const cookieAccessToken = readAccessTokenCookie();
  if (!cookieAccessToken || cookieAccessToken !== accessToken) {
    clearAuthSession();
    return false;
  }

  try {
    await apiRequest("/v1/auth/me", {
      headers: buildAuthHeaders(accessToken),
      timeoutMs: SESSION_VALIDATE_TIMEOUT_MS,
    });
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

export async function login(credentials) {
  const loginData = await loginUser(credentials);
  if (!getAccessToken(loginData)) {
    throw new Error("Login response did not include an access token");
  }
  persistAuthSession(loginData);
  return loginData;
}

export async function signup(credentials) {
  return signupUser(credentials);
}

export async function signupAndLogin(credentials) {
  await signup(credentials);
  return login(credentials);
}

export async function logout() {
  const currentSession = getSession();
  const accessToken = getAccessToken(currentSession);

  // Always clear client session immediately for responsive logout UX.
  clearAuthSession();

  if (!accessToken) {
    return;
  }

  try {
    await logoutUser(accessToken);
  } catch {
    // session is already cleared locally
  }
}
