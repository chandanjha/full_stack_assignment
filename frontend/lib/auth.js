export const ACCESS_TOKEN_COOKIE = "luminalib_access_token";
export const REFRESH_TOKEN_COOKIE = "luminalib_refresh_token";
export const USER_SNAPSHOT_COOKIE = "luminalib_user_snapshot";

function isValidUserSnapshot(value) {
  return (
    value
    && typeof value === "object"
    && typeof value.id === "string"
    && typeof value.email === "string"
    && typeof value.role === "string"
    && typeof value.is_active === "boolean"
  );
}

export function serializeUserSnapshot(user) {
  if (!isValidUserSnapshot(user)) {
    return null;
  }

  return encodeURIComponent(JSON.stringify(user));
}

export function parseUserSnapshot(value) {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(decodeURIComponent(value));
    return isValidUserSnapshot(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function isAuthenticationError(message) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not validate credentials") ||
    normalized.includes("not authenticated")
  );
}
