import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_TOKEN_COOKIE,
  USER_SNAPSHOT_COOKIE,
  isAuthenticationError,
  parseUserSnapshot,
} from "@/lib/auth";
import { getDashboardBootstrapData } from "@/services/dashboard-service";
import DashboardClient from "./dashboard-client";

const DASHBOARD_PAGE_SIZE = 2;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const initialUser = parseUserSnapshot(cookieStore.get(USER_SNAPSHOT_COOKIE)?.value);
  let bootstrapData = {
    initialUser,
    initialBooks: [],
    initialCatalogPage: 1,
    initialCatalogTotalPages: 1,
    initialCatalogTotalItems: 0,
    initialSelectedBookId: null,
    initialReviews: [],
    initialInsight: null,
    initialDetailsLoaded: false,
    initialPreferences: null,
    initialRecommendations: [],
  };

  try {
    bootstrapData = await getDashboardBootstrapData(accessToken, DASHBOARD_PAGE_SIZE, 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard";
    if (isAuthenticationError(message)) {
      redirect("/login");
    }
  }

  return (
    <DashboardClient
      initialUser={bootstrapData.initialUser}
      initialBooks={bootstrapData.initialBooks}
      initialCatalogPage={bootstrapData.initialCatalogPage}
      initialCatalogTotalPages={bootstrapData.initialCatalogTotalPages}
      initialCatalogTotalItems={bootstrapData.initialCatalogTotalItems}
      initialSelectedBookId={bootstrapData.initialSelectedBookId}
      initialReviews={bootstrapData.initialReviews}
      initialInsight={bootstrapData.initialInsight}
      initialDetailsLoaded={bootstrapData.initialDetailsLoaded}
      initialPreferences={bootstrapData.initialPreferences}
      initialRecommendations={bootstrapData.initialRecommendations}
    />
  );
}
