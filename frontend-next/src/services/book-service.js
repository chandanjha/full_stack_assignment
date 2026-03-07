import {
  borrowBook,
  createBook,
  getBookRecommendations,
  getMyPreferences,
  listBookReviews,
  listBooks,
  returnBook,
  submitBookReview,
} from "@/lib/books";

export async function fetchBooks(accessToken, options = {}) {
  const payload = await listBooks(accessToken, options);
  return {
    message: payload?.message || "",
    books: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta || null,
  };
}

export async function addBook(accessToken, payload) {
  return createBook(accessToken, payload);
}

export async function fetchPreferences(accessToken) {
  const payload = await getMyPreferences(accessToken);
  return payload?.data || null;
}

export async function fetchRecommendations(accessToken, options = {}) {
  const payload = await getBookRecommendations(accessToken, options);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchBookReviews(accessToken, bookId) {
  const payload = await listBookReviews(accessToken, bookId);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function addBookReview(accessToken, bookId, payload) {
  return submitBookReview(accessToken, bookId, payload);
}

export async function borrowBookById(accessToken, bookId) {
  return borrowBook(accessToken, bookId);
}

export async function returnBookById(accessToken, bookId) {
  return returnBook(accessToken, bookId);
}
