import { apiRequest, buildAuthHeaders, buildQuery } from "@/lib/api-client";

export async function listBooks(accessToken, options = {}) {
  const { page = 1, pageSize = 20 } = options;
  const query = buildQuery({
    page,
    page_size: pageSize,
  });

  return apiRequest(`/v1/books${query}`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function createBook(accessToken, payload) {
  const formData = new FormData();
  formData.append("title", payload.title);
  if (payload.author) {
    formData.append("author", payload.author);
  }
  if (payload.tags) {
    formData.append("tags", payload.tags);
  }
  formData.append("file", payload.file);

  return apiRequest("/v1/books", {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: formData,
  });
}

export async function getMyPreferences(accessToken) {
  return apiRequest("/v1/books/preferences/me", {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function getBookRecommendations(accessToken, options = {}) {
  const { limit = 5, timeoutMs } = options;
  const query = buildQuery({ limit });

  return apiRequest(`/v1/books/recommendations${query}`, {
    headers: buildAuthHeaders(accessToken),
    timeoutMs,
  });
}

export async function listBookReviews(accessToken, bookId) {
  return apiRequest(`/v1/books/${bookId}/reviews`, {
    headers: buildAuthHeaders(accessToken),
  });
}

export async function submitBookReview(accessToken, bookId, payload) {
  return apiRequest(`/v1/books/${bookId}/reviews`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: payload,
  });
}

export async function borrowBook(accessToken, bookId) {
  return apiRequest(`/v1/books/${bookId}/borrow`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });
}

export async function returnBook(accessToken, bookId) {
  return apiRequest(`/v1/books/${bookId}/return`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });
}
