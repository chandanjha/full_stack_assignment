const SERVER_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";

const DEFAULT_SERVER_REQUEST_TIMEOUT_MS = 20000;

function extractErrorMessage(payload, fallbackMessage = "Request failed") {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0];
    if (firstError && typeof firstError.message === "string" && firstError.message.trim()) {
      return firstError.message;
    }
  }

  return fallbackMessage;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function serverApiRequest(path, options = {}) {
  const {
    method = "GET",
    accessToken = "",
    headers = {},
    body,
    timeoutMs = DEFAULT_SERVER_REQUEST_TIMEOUT_MS,
  } = options;
  const requestHeaders = { ...headers };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let requestBody;
  if (body !== undefined && body !== null) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${SERVER_API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: requestBody,
      cache: "no-store",
      signal: abortController.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Could not connect to backend API");
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload;
}
