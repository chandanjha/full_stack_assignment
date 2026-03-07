import {
  clearAuthSession,
  loginUser,
  logoutUser,
  persistAuthSession,
  readAuthSession,
  signupUser,
  subscribeAuthChange,
} from "@/lib/auth";

function getAccessToken(session) {
  return session?.token?.access_token || "";
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

