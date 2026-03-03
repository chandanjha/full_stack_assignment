"use client";

export default function Recommendations({
  recommendations,
  recommendationsLoading,
}) {
  const isInitialLoad = recommendationsLoading && recommendations.length === 0;

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Discovery</p>
          <h3 className="mt-2 text-2xl font-semibold">AI Content-Based Filters</h3>
        </div>
        {recommendationsLoading && recommendations.length > 0 && (
          <span className="text-sm text-slate-500">Refreshing...</span>
        )}
      </div>

      {isInitialLoad ? (
        <p className="text-sm text-slate-500">
          Building content-based recommendations from your reading profile and book summaries.
        </p>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-slate-500">
          No unread titles currently match your profile. Upload more books or broaden the catalog.
        </p>
      ) : (
        <div className="space-y-4">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.book.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{recommendation.book.title}</p>
                  <p className="text-sm text-slate-600">
                    {recommendation.book.author || "Unknown author"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Score {recommendation.score}
                </span>
              </div>

              {recommendation.book.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendation.book.tags.map((tag) => (
                    <span
                      key={`${recommendation.book.id}-${tag}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-1">
                {recommendation.reasons.map((reason) => (
                  <p key={`${recommendation.book.id}-${reason}`} className="text-sm text-slate-600">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
