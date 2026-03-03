"use client";

export default function ReviewForm({
  reviewForm,
  reviewSubmitting,
  onChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-semibold">Submit Review</h4>
        <select
          name="rating"
          value={reviewForm.rating}
          onChange={onChange}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} / 5
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="comment"
        value={reviewForm.comment}
        onChange={onChange}
        rows={4}
        placeholder="Share what readers should know."
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
      />
      <button
        type="submit"
        disabled={reviewSubmitting}
        className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {reviewSubmitting ? "Submitting..." : "Post Review"}
      </button>
    </form>
  );
}
