import {
  fetchPreferences,
  fetchRecommendations,
} from "@/services/book-service";

export async function fetchDashboardData(accessToken, options = {}) {
  const { recommendationLimit = 5 } = options;
  const [preferences, recommendations] = await Promise.all([
    fetchPreferences(accessToken),
    fetchRecommendations(accessToken, { limit: recommendationLimit }),
  ]);

  return {
    preferences,
    recommendations,
  };
}

