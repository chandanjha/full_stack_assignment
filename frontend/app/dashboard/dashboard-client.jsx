"use client";

import { useEffect, useState } from "react";

import FullPageLoader from "@/components/FullPageLoader";
import BookDetails from "@/components/book/BookDetails";
import BookList from "@/components/book/BookList";
import Toast from "@/components/Toast";
import UploadBookForm from "@/components/book/UploadBookForm";
import Recommendations from "@/components/recommendations/Recommendations";
import { useDashboardController } from "@/hooks/use-dashboard-controller";

export default function DashboardClient({
  initialUser,
  initialBooks,
  initialCatalogPage,
  initialCatalogTotalPages,
  initialCatalogTotalItems,
  initialSelectedBookId,
  initialReviews,
  initialInsight,
  initialPreferences,
  initialRecommendations,
}) {
  const {
    user,
    books,
    catalogPage,
    catalogTotalPages,
    catalogTotalItems,
    selectedBookId,
    selectedBook,
    reviews,
    insight,
    preferences,
    recommendations,
    profileLoading,
    booksLoading,
    detailLoading,
    preferencesLoading,
    recommendationsLoading,
    uploading,
    reviewSubmitting,
    bookActionId,
    loggingOut,
    error,
    notice,
    uploadForm,
    uploadFormResetKey,
    reviewForm,
    pageSize,
    handlePageChange,
    handleLogout,
    handleUploadChange,
    handleReviewChange,
    handleUploadSubmit,
    handleBookAction,
    handleReviewSubmit,
    handleSelectBook,
  } = useDashboardController({
    initialUser,
    initialBooks,
    initialCatalogPage,
    initialCatalogTotalPages,
    initialCatalogTotalItems,
    initialSelectedBookId,
    initialReviews,
    initialInsight,
    initialPreferences,
    initialRecommendations,
  });
  const [toastState, setToastState] = useState({
    message: "",
    variant: "success",
  });
  const userEmailLabel = user?.email || (profileLoading ? "Loading account..." : "Account unavailable");
  const userRoleLabel = user?.role || (profileLoading ? "Loading..." : "Unavailable");
  const userStatusLabel = user
    ? user.is_active
      ? "Active"
      : "Inactive"
    : profileLoading
      ? "Loading..."
      : "Unavailable";
  const isPreferencesBootstrapping = preferencesLoading && preferences === null;

  useEffect(() => {
    const nextMessage = error || notice;

    if (!nextMessage) {
      setToastState((currentToast) => (
        currentToast.message
          ? {
              message: "",
              variant: "success",
            }
          : currentToast
      ));
      return;
    }

    setToastState({
      message: nextMessage,
      variant: error ? "error" : "success",
    });
    const timeoutId = window.setTimeout(() => {
      setToastState({
        message: "",
        variant: "success",
      });
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [error, notice]);

  let blockingLoader = null;

  if (loggingOut) {
    blockingLoader = {
      title: "Signing you out",
      description: "Please wait while we close your current session.",
    };
  } else if (uploading) {
    blockingLoader = {
      title: "Uploading your book",
      description: "The file is being sent and prepared for processing.",
    };
  } else if (reviewSubmitting) {
    blockingLoader = {
      title: "Posting your review",
      description: "Please wait while we save your feedback.",
    };
  }

  return (
    <>
      <FullPageLoader
        visible={Boolean(blockingLoader)}
        overlay
        title={blockingLoader?.title}
        description={blockingLoader?.description}
      />
      <Toast
        message={toastState.message}
        variant={toastState.variant}
        onDismiss={() => setToastState({
          message: "",
          variant: "success",
        })}
      />
      <div className="min-h-screen bg-[linear-gradient(135deg,#f6f2e9_0%,#dfe7f2_45%,#f8fafc_100%)] text-slate-900">
        <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">LuminaLib</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Reader Operations Console</h1>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <section className="space-y-8">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-slate-500">Signed in as</p>
                  <h2 className="mt-1 text-2xl font-semibold">{userEmailLabel}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <p className="text-slate-500">Role</p>
                    <p className="font-semibold">{userRoleLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <p className="text-slate-500">Status</p>
                    <p className="font-semibold">{userStatusLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <p className="text-slate-500">Books</p>
                    <p className="font-semibold">{catalogTotalItems}</p>
                  </div>
                </div>
              </div>
            </div>

            <UploadBookForm
              uploadForm={uploadForm}
              fileInputResetKey={uploadFormResetKey}
              uploading={uploading}
              onChange={handleUploadChange}
              onSubmit={handleUploadSubmit}
            />

            <BookList
              books={books}
              selectedBookId={selectedBookId}
              bookActionId={bookActionId}
              catalogPage={catalogPage}
              catalogTotalPages={catalogTotalPages}
              catalogTotalItems={catalogTotalItems}
              booksLoading={booksLoading}
              pageSize={pageSize}
              onSelectBook={handleSelectBook}
              onBookAction={handleBookAction}
              onPageChange={handlePageChange}
            />

            <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Preferences</p>
                  <h3 className="mt-2 text-2xl font-semibold">Reader Preference Profile</h3>
                </div>
                {preferencesLoading && preferences !== null && (
                  <span className="text-sm text-slate-500">Updating...</span>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-sm font-medium text-slate-500">Preference Summary</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {isPreferencesBootstrapping
                      ? "Analyzing your reading profile in the background..."
                      : preferences?.preference_summary || "Not enough reading data yet to establish preferences."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">Tags</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(preferences?.preferred_tags || []).length > 0 ? (
                        preferences?.preferred_tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          {isPreferencesBootstrapping ? "Loading tags..." : "No favorite tags yet."}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">Authors</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(preferences?.preferred_authors || []).length > 0 ? (
                        preferences?.preferred_authors.map((author) => (
                          <span
                            key={author}
                            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
                          >
                            {author}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          {isPreferencesBootstrapping ? "Loading authors..." : "No favored authors yet."}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-8">
            {error && (
              <div
                className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700"
              >
                {error}
              </div>
            )}

            <BookDetails
              selectedBook={selectedBook}
              detailLoading={detailLoading}
              readerConsensus={insight?.reader_consensus}
              reviews={reviews}
              reviewForm={reviewForm}
              reviewSubmitting={reviewSubmitting}
              onReviewChange={handleReviewChange}
              onReviewSubmit={handleReviewSubmit}
            />

            <Recommendations
              recommendations={recommendations}
              recommendationsLoading={recommendationsLoading}
            />
          </section>
        </main>
      </div>
    </>
  );
}
