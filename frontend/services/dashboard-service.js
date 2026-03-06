import "server-only";

import { ServerAuthAPI, ServerBooksAPI } from "@/lib/server-api";

const DEFAULT_RECOMMENDATION_LIMIT = 5;

function sortBooksByNewest(items) {
  return [...items].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSettledData(result, fallbackValue) {
  return result.status === "fulfilled" ? result.value.data : fallbackValue;
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
  const detailPromise = initialSelectedBookId
    ? Promise.all([
      ServerBooksAPI.listReviews(accessToken, initialSelectedBookId),
      ServerBooksAPI.getInsight(accessToken, initialSelectedBookId),
    ]).then(([reviewsResponse, insightResponse]) => ({
      reviews: toArray(reviewsResponse.data),
      insight: insightResponse.data ?? null,
    }))
    : Promise.resolve({
      reviews: [],
      insight: null,
    });
  const [preferencesResult, recommendationsResult, detailsResult] = await Promise.allSettled([
    ServerBooksAPI.getMyPreferences(accessToken),
    ServerBooksAPI.getRecommendations(accessToken, DEFAULT_RECOMMENDATION_LIMIT),
    detailPromise,
  ]);

  const detailsData = detailsResult.status === "fulfilled"
    ? detailsResult.value
    : {
      reviews: [],
      insight: null,
    };
  const initialDetailsLoaded = !initialSelectedBookId || detailsResult.status === "fulfilled";

  return {
    initialUser: userResponse.data,
    initialBooks: orderedBooks,
    initialCatalogPage: booksResponse.meta.page,
    initialCatalogTotalPages: Math.max(booksResponse.meta.total_pages, 1),
    initialCatalogTotalItems: booksResponse.meta.total_items,
    initialSelectedBookId: initialSelectedBookId ?? null,
    initialReviews: detailsData.reviews,
    initialInsight: detailsData.insight,
    initialDetailsLoaded,
    initialPreferences: getSettledData(preferencesResult, null),
    initialRecommendations: toArray(getSettledData(recommendationsResult, [])),
  };
}
