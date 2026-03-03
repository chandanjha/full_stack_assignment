import { BooksAPI } from "@/lib/api";

export const bookService = {
  listBooks(page = 1, pageSize = 20) {
    return BooksAPI.listBooks(page, pageSize);
  },

  getReaderPreferences() {
    return BooksAPI.getMyPreferences();
  },

  getRecommendations(limit = 5) {
    return BooksAPI.getRecommendations(limit);
  },

  createBook(input) {
    return BooksAPI.createBook(input);
  },

  borrowBook(bookId) {
    return BooksAPI.borrowBook(bookId);
  },

  returnBook(bookId) {
    return BooksAPI.returnBook(bookId);
  },

  createReview(bookId, input) {
    return BooksAPI.createReview(bookId, input);
  },

  async getBookDetails(bookId) {
    const [reviewResponse, insightResponse] = await Promise.all([
      BooksAPI.listReviews(bookId),
      BooksAPI.getInsight(bookId),
    ]);

    return {
      insight: insightResponse.data,
      reviews: reviewResponse.data,
    };
  },

  async getReaderIntelligence(limit = 5) {
    const [preferencesResponse, recommendationsResponse] = await Promise.all([
      this.getReaderPreferences(),
      this.getRecommendations(limit),
    ]);

    return {
      preferences: preferencesResponse.data,
      recommendations: recommendationsResponse.data,
    };
  },
};
