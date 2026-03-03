import "server-only";

import { ServerAuthAPI, ServerBooksAPI } from "@/lib/server-api";

function sortBooksByNewest(items) {
  return [...items].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export async function getDashboardBootstrapData(
  accessToken,
  pageSize,
  page = 1,
) {
  const [userResponse, booksResponse] = await Promise.all([
    ServerAuthAPI.getProfile(accessToken),
    ServerBooksAPI.listBooks(accessToken, page, pageSize),
  ]);

  const orderedBooks = sortBooksByNewest(booksResponse.data);
  const initialSelectedBookId = orderedBooks[0]?.id ?? null;

  return {
    initialUser: userResponse.data,
    initialBooks: orderedBooks,
    initialCatalogPage: booksResponse.meta.page,
    initialCatalogTotalPages: Math.max(booksResponse.meta.total_pages, 1),
    initialCatalogTotalItems: booksResponse.meta.total_items,
    initialSelectedBookId: initialSelectedBookId ?? null,
    initialReviews: [],
    initialInsight: null,
    initialPreferences: null,
    initialRecommendations: [],
  };
}
