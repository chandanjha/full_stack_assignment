"use client";
import ReaderConsensus from "@/components/insights/ReaderConsensus";
import ReviewForm from "@/components/review/ReviewForm";
import ReviewList from "@/components/review/ReviewList";

export default function BookDetails({
  selectedBook,
  detailLoading,
  readerConsensus,
  reviews,
  reviewForm,
  reviewSubmitting,
  onReviewChange,
  onReviewSubmit,
}) {
  const summaryText = selectedBook
    ? selectedBook.summary || selectedBook.summary_error || "Summary generation is still pending."
    : "";

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Selected Book</p>
        <h3 className="mt-2 text-2xl font-semibold">
          {selectedBook ? selectedBook.title : "Choose a book"}
        </h3>
      </div>

      {!selectedBook ? (
        <p className="text-slate-500">Pick a book from the catalog to see reviews and insight.</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-sm font-medium text-slate-500">Summary Preview</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {summaryText}
            </p>
          </div>

          <ReaderConsensus detailLoading={detailLoading} readerConsensus={readerConsensus} />

          <ReviewForm
            reviewForm={reviewForm}
            reviewSubmitting={reviewSubmitting}
            onChange={onReviewChange}
            onSubmit={onReviewSubmit}
          />

          <ReviewList detailLoading={detailLoading} reviews={reviews} />
        </div>
      )}
    </div>
  );
}
