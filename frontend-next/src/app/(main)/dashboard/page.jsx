import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { serverApiRequest } from "@/lib/server-api";

const AUTH_ACCESS_TOKEN_COOKIE_KEY = "luminalib_access_token";
const RECOMMENDATION_REQUEST_TIMEOUT_MS = 20000;

export const dynamic = "force-dynamic";

function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  try {
    return new Date(dateValue).toLocaleString();
  } catch {
    return String(dateValue);
  }
}

function getRecommendationErrorMessage(message) {
  if (typeof message === "string" && message.toLowerCase().includes("timed out")) {
    return "Recommendations are taking longer than expected. Please click Refresh.";
  }
  return message || "Unable to load recommendations";
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_KEY)?.value || "";
  if (!accessToken) {
    redirect("/login");
  }

  let user = null;
  try {
    const authPayload = await serverApiRequest("/v1/auth/me", { accessToken, timeoutMs: 10000 });
    user = authPayload?.data || null;
  } catch {
    redirect("/login");
  }

  let preferences = null;
  let recommendations = [];
  let preferencesError = "";
  let recommendationsError = "";

  // Load preferences first to avoid sending both requests simultaneously.
  try {
    const preferencesPayload = await serverApiRequest("/v1/books/preferences/me", { accessToken });
    preferences = preferencesPayload?.data || null;
  } catch (requestError) {
    preferencesError = requestError?.message || "Unable to load preferences";
  }

  // Load recommendations after preferences.
  try {
    const recommendationsPayload = await serverApiRequest("/v1/books/recommendations?limit=5", {
      accessToken,
      timeoutMs: RECOMMENDATION_REQUEST_TIMEOUT_MS,
    });
    recommendations = Array.isArray(recommendationsPayload?.data) ? recommendationsPayload.data : [];
  } catch (requestError) {
    recommendationsError = getRecommendationErrorMessage(requestError?.message);
  }

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Dashboard</h1>
        <Link href="/dashboard" className="btn btn-outline-primary btn-sm">
          Refresh
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Logged In User</h5>
          <p className="mb-1"><strong>Email:</strong> {user?.email || "-"}</p>
          <p className="mb-1 text-capitalize"><strong>Role:</strong> {user?.role || "-"}</p>
          <p className="mb-0"><strong>Status:</strong> {user?.is_active ? "Active" : "Inactive"}</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Your Preferences</h5>

          {preferencesError ? <div className="alert alert-danger py-2 mb-0">{preferencesError}</div> : null}

          {!preferencesError ? (
            <>
              <p className="mb-2">
                <strong>Preference Summary:</strong>{" "}
                {preferences?.preference_summary || "Not enough history yet to generate preference summary."}
              </p>
              <p className="mb-2">
                <strong>Preferred Tags:</strong>{" "}
                {Array.isArray(preferences?.preferred_tags) && preferences.preferred_tags.length > 0 ? (
                  preferences.preferred_tags.map((tag) => (
                    <span key={tag} className="badge bg-primary me-1">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">No preferred tags yet.</span>
                )}
              </p>
              <p className="mb-2">
                <strong>Preferred Authors:</strong>{" "}
                {Array.isArray(preferences?.preferred_authors) && preferences.preferred_authors.length > 0 ? (
                  preferences.preferred_authors.map((author) => (
                    <span key={author} className="badge bg-secondary me-1">
                      {author}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">No preferred authors yet.</span>
                )}
              </p>
              <p className="mb-0 text-muted small">
                Updated At: {formatDate(preferences?.updated_at)}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Book Recommendations</h5>

          {recommendationsError ? <div className="alert alert-danger py-2">{recommendationsError}</div> : null}

          {!recommendationsError ? (
            recommendations.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Title</th>
                      <th scope="col">Author</th>
                      <th scope="col">Score</th>
                      <th scope="col">Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((item, index) => (
                      <tr key={item?.book?.id || `recommendation-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item?.book?.title || "-"}</td>
                        <td>{item?.book?.author || "-"}</td>
                        <td>{item?.score ?? "-"}</td>
                        <td>
                          {Array.isArray(item?.reasons) && item.reasons.length > 0
                            ? item.reasons.join(", ")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted mb-0">No recommendations available yet.</p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
