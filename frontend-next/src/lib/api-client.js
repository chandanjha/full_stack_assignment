export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

function extractErrorMessage(payload, fallbackMessage = "Request failed") {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const firstErrorMessage = Array.isArray(payload.errors) && payload.errors.length > 0
    ? payload.errors
      .map((item) => item?.message || item?.msg || item?.detail || "")
      .find((message) => typeof message === "string" && message.trim())
    : "";

  if (typeof payload.message === "string" && payload.message.trim()) {
    const genericMessage = payload.message.trim().toLowerCase();
    if (firstErrorMessage && (genericMessage === "validation error" || genericMessage === "request failed")) {
      return firstErrorMessage;
    }
    return payload.message;
  }

  if (firstErrorMessage) {
    return firstErrorMessage;
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

export function buildAuthHeaders(accessToken, headers = {}) {
  if (!accessToken) {
    return { ...headers };
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    ...headers,
  };
}

export function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.append(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal,
  } = options;
  const requestHeaders = { ...headers };

  let requestBody;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      requestBody = body;
    } else {
      requestHeaders["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  let timeoutId;
  const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
  if (abortController && signal) {
    if (signal.aborted) {
      abortController.abort();
    } else {
      signal.addEventListener("abort", () => abortController.abort(), { once: true });
    }
  }

  let response;
  try {
    if (abortController && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
    }
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: requestBody,
      cache: "no-store",
      signal: abortController?.signal || signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Could not connect to backend API");
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload;
}
