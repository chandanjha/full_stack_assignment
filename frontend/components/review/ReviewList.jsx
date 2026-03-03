"use client";

export default function ReviewList({ detailLoading, reviews }) {
  return (
    <div>
      <h4 className="text-lg font-semibold">Recent Reviews</h4>
      <div className="mt-4 space-y-3">
        {detailLoading ? (
          <p className="text-sm text-slate-500">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet for this title.</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-slate-900">{review.rating} / 5</span>
                <span className="text-xs text-slate-500">
                  {new Date(review.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {review.comment || "No written comment."}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
