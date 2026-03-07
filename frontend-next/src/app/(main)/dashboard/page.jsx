"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getSession } from "@/services/auth-service";
import { fetchPreferences, fetchRecommendations } from "@/services/book-service";

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

export default function Dashboard() {
  const session = getSession();
  const accessToken = session?.token?.access_token || "";
  const isLoggedIn = Boolean(accessToken);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(isLoggedIn);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(isLoggedIn);
  const [preferencesError, setPreferencesError] = useState("");
  const [recommendationsError, setRecommendationsError] = useState("");
  const [preferences, setPreferences] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const loadDashboardData = useCallback(async () => {
    if (!isLoggedIn) {
      setIsLoadingPreferences(false);
      setIsLoadingRecommendations(false);
      setPreferencesError("");
      setRecommendationsError("");
      setPreferences(null);
      setRecommendations([]);
      return;
    }

    setPreferencesError("");
    setRecommendationsError("");
    setIsLoadingPreferences(true);
    setIsLoadingRecommendations(true);

    const [preferencesResult, recommendationsResult] = await Promise.allSettled([
      fetchPreferences(accessToken),
      fetchRecommendations(accessToken, { limit: 5, timeoutMs: 20000 }),
    ]);

    if (preferencesResult.status === "fulfilled") {
      setPreferences(preferencesResult.value);
    } else {
      setPreferencesError(preferencesResult.reason?.message || "Unable to load preferences");
    }
    setIsLoadingPreferences(false);

    if (recommendationsResult.status === "fulfilled") {
      setRecommendations(recommendationsResult.value);
    } else {
      setRecommendationsError(getRecommendationErrorMessage(recommendationsResult.reason?.message));
    }
    setIsLoadingRecommendations(false);
  }, [accessToken, isLoggedIn]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timerId);
  }, [loadDashboardData]);

  if (!isLoggedIn) {
    return (
      <div className="alert alert-warning mt-3">
        Please{" "}
        <Link href="/login" className="alert-link">
          login
        </Link>{" "}
        to view your dashboard.
      </div>
    );
  }

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Dashboard</h1>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={loadDashboardData}
          disabled={isLoadingPreferences || isLoadingRecommendations}
        >
          Refresh
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Logged In User</h5>
          <p className="mb-1"><strong>Email:</strong> {session?.user?.email || "-"}</p>
          <p className="mb-1 text-capitalize"><strong>Role:</strong> {session?.user?.role || "-"}</p>
          <p className="mb-0"><strong>Status:</strong> {session?.user?.is_active ? "Active" : "Inactive"}</p>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Your Preferences</h5>

          {isLoadingPreferences ? <p className="text-muted mb-0">Loading preferences...</p> : null}
          {preferencesError ? <div className="alert alert-danger py-2 mb-0">{preferencesError}</div> : null}

          {!isLoadingPreferences && !preferencesError ? (
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

          {isLoadingRecommendations ? <p className="text-muted">Loading recommendations...</p> : null}
          {recommendationsError ? <div className="alert alert-danger py-2">{recommendationsError}</div> : null}

          {!isLoadingRecommendations && !recommendationsError ? (
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
