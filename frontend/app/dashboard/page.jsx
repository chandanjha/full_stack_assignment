import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, USER_SNAPSHOT_COOKIE, parseUserSnapshot } from "@/lib/auth";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const initialUser = parseUserSnapshot(cookieStore.get(USER_SNAPSHOT_COOKIE)?.value);

  return (
    <DashboardClient
      initialUser={initialUser}
      initialBooks={[]}
      initialCatalogPage={1}
      initialCatalogTotalPages={1}
      initialCatalogTotalItems={0}
      initialSelectedBookId={null}
      initialReviews={[]}
      initialInsight={null}
      initialPreferences={null}
      initialRecommendations={[]}
    />
  );
}
