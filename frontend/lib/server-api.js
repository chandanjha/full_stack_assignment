import "server-only";

import { BACKEND_API_BASE_URL } from "@/lib/config";


async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  throw new Error("Unexpected non-JSON response");
}

async function extractErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const error = await response.json();
    return error.detail || error.message || "Request failed";
  }

  const responseText = (await response.text()).trim();
  return responseText || "Request failed";
}

async function serverRequest(path, token) {
  const response = await fetch(`${BACKEND_API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return parseJsonResponse(response);
}

export const ServerAuthAPI = {
  getProfile(token) {
    return serverRequest("/v1/auth/me", token);
  },
};

export const ServerBooksAPI = {
  listBooks(token, page = 1, pageSize = 20) {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return serverRequest(`/v1/books?${query.toString()}`, token);
  },

  getMyPreferences(token) {
    return serverRequest("/v1/books/preferences/me", token);
  },

  getRecommendations(token, limit = 5) {
    const query = new URLSearchParams({
      limit: String(limit),
    });
    return serverRequest(`/v1/books/recommendations?${query.toString()}`, token);
  },

  listReviews(token, bookId) {
    return serverRequest(`/v1/books/${bookId}/reviews`, token);
  },

  getInsight(token, bookId) {
    return serverRequest(`/v1/books/${bookId}/insight`, token);
  },
};
